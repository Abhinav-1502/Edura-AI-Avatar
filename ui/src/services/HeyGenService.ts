/* eslint-disable @typescript-eslint/no-explicit-any */
import { Room, RoomEvent, Track } from 'livekit-client';

const LIVEAVATAR_API_URL = 'https://api.liveavatar.com';

export interface HeyGenConfig {
    quality?: string;
    knowledgeId?: string;
    disableIdleTimeout?: boolean;
}

export class HeyGenService {
    private room: Room | null = null;
    private ws: WebSocket | null = null;
    private sessionToken: string | null = null;
    private livekitUrl: string | null = null;
    private livekitToken: string | null = null;
    private wsUrl: string | null = null;
    private mediaStream: MediaStream | null = null;
    private wsReady = false;
    private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

    // Callbacks
    public onAvatarStartTalking?: (headId: number) => void;
    public onAvatarStopTalking?: (headId: number) => void;
    public onUserStartTalking?: (text: string) => void;
    public onUserStopTalking?: (text: string) => void;
    public onStreamReady?: (stream: MediaStream) => void;
    public onDisconnected?: () => void;
    public onAvatarEvent?: (event: any) => void;

    // ── Step 1: Start session → get LiveKit + WebSocket credentials ──────────
    async initialize(sessionToken: string): Promise<void> {
        this.sessionToken = sessionToken;

        console.log('[HeyGenService] Calling /v1/sessions/start (LITE mode)...');
        const startResp = await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/start`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!startResp.ok) {
            throw new Error(`[HeyGenService] sessions/start failed: ${startResp.status} ${startResp.statusText}`);
        }
        const startJson = await startResp.json();

        // ── DEBUG: log the full response so we can inspect every field ──────
        console.log('[HeyGenService] sessions/start full response:', JSON.stringify(startJson, null, 2));

        const d = startJson.data ?? startJson;
        this.livekitUrl   = d.livekit_url        ?? null;
        this.livekitToken = d.livekit_client_token ?? d.livekit_token ?? null;
        this.wsUrl        = d.ws_url              ?? null;

        console.log('[HeyGenService] livekit_url          :', this.livekitUrl);
        console.log('[HeyGenService] livekit_client_token :', this.livekitToken ? '(present)' : 'MISSING');
        console.log('[HeyGenService] ws_url               :', this.wsUrl ?? 'NOT PROVIDED (will use LiveKit data channel)');

        if (this.wsUrl) {
            console.log('%c[HeyGenService] MODE: LITE ✅ — ElevenLabs TTS + LiveAvatar video rendering', 'color: #22c55e; font-weight: bold');
        } else {
            console.warn('[HeyGenService] MODE: FULL (fallback) — ws_url missing, LiveAvatar handles TTS');
        }
    }

    // ── Step 2: Connect LiveKit (video) + WebSocket (audio commands) ─────────
    async startSession(_config?: any): Promise<void> {
        if (!this.livekitUrl || !this.livekitToken) {
            throw new Error('[HeyGenService] startSession: call initialize() first');
        }

        // — LiveKit room: receives the avatar video/audio stream —
        console.log('[HeyGenService] Connecting to LiveKit room...');
        this.room = new Room();

        this.room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
            if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                if (!this.mediaStream) this.mediaStream = new MediaStream();
                this.mediaStream.addTrack(track.mediaStreamTrack);
                console.log('[HeyGenService] Track subscribed:', track.kind);
                if (this.onStreamReady) this.onStreamReady(this.mediaStream);
            }
        });

        this.room.on(RoomEvent.DataReceived, (payload, _p, _k, topic) => {
            // In LITE mode, LiveKit data channel may carry state events even if audio
            // commands go via ws_url. Log everything so we can see what arrives.
            try {
                const event = JSON.parse(new TextDecoder().decode(payload));
                console.log('[HeyGenService] LiveKit DataReceived topic=' + topic, event);
                this._handleServerEvent(event);
            } catch (e) {
                console.warn('[HeyGenService] DataReceived parse error:', e);
            }
        });

        this.room.on(RoomEvent.Disconnected, () => {
            console.warn('[HeyGenService] LiveKit room disconnected');
            if (this.onDisconnected) this.onDisconnected();
        });

        await this.room.connect(this.livekitUrl, this.livekitToken);
        console.log('[HeyGenService] LiveKit room connected ✅');

        // — WebSocket: sends audio commands to LiveAvatar —
        if (this.wsUrl) {
            await this._connectWebSocket(this.wsUrl);
        } else {
            console.warn(
                '[HeyGenService] ws_url not provided by LiveAvatar.' +
                ' LITE mode audio commands will NOT work until ws_url is present.' +
                ' Check the sessions/start response logged above.'
            );
        }
    }

    private _connectWebSocket(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('[HeyGenService][LITE] Connecting control WebSocket:', url);
            const ws = new WebSocket(url);
            this.ws = ws;

            const timeout = setTimeout(() => {
                reject(new Error('[HeyGenService] WebSocket connection timed out (10s)'));
            }, 10_000);

            ws.onopen = () => {
                // LiveAvatar LITE signaling server is ready to receive commands immediately
                // on open — no handshake message is sent before the connection is usable.
                console.log('[HeyGenService][LITE] WebSocket connected ✅ — ready to send audio');
                this.wsReady = true;
                clearTimeout(timeout);

                // Send session.keep_alive every 60s to prevent the 5-minute idle timeout.
                // Documented in LiveAvatar LITE Mode events spec.
                if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
                this.keepAliveInterval = setInterval(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ type: 'session.keep_alive', event_id: crypto.randomUUID() }));
                        console.log('[HeyGenService] Sent session.keep_alive');
                    }
                }, 60_000);

                resolve();
            };

            ws.onmessage = (evt) => {
                try {
                    const event = JSON.parse(evt.data);
                    console.log('[HeyGenService][LITE] WebSocket event received:', event);

                    // session.state_updated may still arrive after open — log it for info
                    if (event.type === 'session.state_updated') {
                        console.log('[HeyGenService][LITE] session.state_updated state=' + event.state);
                    }

                    this._handleServerEvent(event);
                } catch (e) {
                    console.warn('[HeyGenService] WebSocket message parse error:', e);
                }
            };

            ws.onerror = (err) => {
                console.error('[HeyGenService] WebSocket error:', err);
                clearTimeout(timeout);
                reject(new Error('[HeyGenService] WebSocket error — see console'));
            };

            ws.onclose = (evt) => {
                console.warn('[HeyGenService] WebSocket closed:', evt.code, evt.reason);
                this.wsReady = false;
                if (this.keepAliveInterval) {
                    clearInterval(this.keepAliveInterval);
                    this.keepAliveInterval = null;
                }
                if (this.onDisconnected) this.onDisconnected();
            };
        });
    }

    private _handleServerEvent(event: any): void {
        if (this.onAvatarEvent) this.onAvatarEvent(event);

        // LITE mode event types (agent.*) and shared events (session.*)
        switch (event.type ?? event.event_type) {
            case 'agent.speak_started':
            case 'avatar.speak_started':
                if (this.onAvatarStartTalking) this.onAvatarStartTalking(0);
                break;
            case 'agent.speak_ended':
            case 'avatar.speak_ended':
                if (this.onAvatarStopTalking) this.onAvatarStopTalking(0);
                break;
            case 'user.speak_started':
                if (this.onUserStartTalking) this.onUserStartTalking('');
                break;
            case 'user.speak_ended':
                if (this.onUserStopTalking) this.onUserStopTalking('');
                break;
            case 'session.stopped':
                if (this.onDisconnected) this.onDisconnected();
                break;
        }
    }

    // ── speak: sends base64 PCM audio via WebSocket (LITE mode) ─────────────
    // base64Audio should be raw PCM 16-bit 24kHz mono, base64-encoded.
    // Audio is sent in chunks to stay under the server's WS message size limit.
    // (A single large message causes a 1006 close on the server side.)
    async speak(base64Audio: string): Promise<void> {
        if (!this.ws || !this.wsReady) {
            console.error(
                '[HeyGenService] speak() called but WebSocket is',
                !this.ws ? 'null (ws_url was not provided)' : 'not ready yet'
            );
            return;
        }
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.error('[HeyGenService] speak() called but WebSocket readyState is', this.ws.readyState, '(not OPEN). Marking as not ready.');
            this.wsReady = false;
            return;
        }

        // Decode → chunk → re-encode. 48 000 bytes ≈ 1 s of 24 kHz 16-bit mono PCM.
        // Keeping chunks at ~48 KB PCM (~64 KB base64) stays well under any WS frame limit.
        const PCM_CHUNK_BYTES = 48_000;
        const pcm = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
        const totalChunks = Math.ceil(pcm.length / PCM_CHUNK_BYTES);

        for (let i = 0; i < totalChunks; i++) {
            const slice = pcm.slice(i * PCM_CHUNK_BYTES, (i + 1) * PCM_CHUNK_BYTES);
            let binary = '';
            for (let j = 0; j < slice.length; j++) binary += String.fromCharCode(slice[j]);
            this.ws.send(JSON.stringify({ type: 'agent.speak', audio: btoa(binary) }));
        }

        const eventId = crypto.randomUUID();
        this.ws.send(JSON.stringify({ type: 'agent.speak_end', event_id: eventId }));
        console.log(`[HeyGenService] Sent ${totalChunks} agent.speak chunk(s) + agent.speak_end  event_id=${eventId}`);
    }

    async stopSpeaking(): Promise<void> {
        if (this.ws && this.wsReady) {
            this.ws.send(JSON.stringify({ type: 'agent.interrupt' }));
            console.log('[HeyGenService] Sent agent.interrupt');
        }
    }

    async startListening(): Promise<void> {
        if (this.ws && this.wsReady) {
            this.ws.send(JSON.stringify({ type: 'agent.start_listening', event_id: crypto.randomUUID() }));
        }
    }

    async stopListening(): Promise<void> {
        if (this.ws && this.wsReady) {
            this.ws.send(JSON.stringify({ type: 'agent.stop_listening', event_id: crypto.randomUUID() }));
        }
    }

    async close(): Promise<void> {
        // Stop session on LiveAvatar server
        if (this.sessionToken) {
            try {
                await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/stop`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${this.sessionToken}` },
                });
                console.log('[HeyGenService] Session stopped on server');
            } catch (e) {
                console.warn('[HeyGenService] Failed to stop session on server:', e);
            }
        }

        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }

        if (this.ws) {
            this.ws.onclose = null; // prevent onDisconnected firing during intentional close
            this.ws.close();
            this.ws = null;
        }

        if (this.room) {
            await this.room.disconnect();
            this.room = null;
        }

        this.wsReady = false;
        this.sessionToken = null;
        this.livekitUrl = null;
        this.livekitToken = null;
        this.wsUrl = null;
        this.mediaStream = null;
    }
}
