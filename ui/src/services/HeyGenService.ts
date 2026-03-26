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
    private sessionToken: string | null = null;
    private livekitUrl: string | null = null;
    private livekitToken: string | null = null;
    private mediaStream: MediaStream | null = null;

    // Callbacks
    public onAvatarStartTalking?: (headId: number) => void;
    public onAvatarStopTalking?: (headId: number) => void;
    public onUserStartTalking?: (text: string) => void;
    public onUserStopTalking?: (text: string) => void;
    public onStreamReady?: (stream: MediaStream) => void;
    public onDisconnected?: () => void;
    public onAvatarEvent?: (event: any) => void;

    private sendCommand(eventType: string, data: Record<string, any> = {}): void {
        if (!this.room) return;
        const payload = JSON.stringify({
            event_id: crypto.randomUUID(),
            event_type: eventType,
            ...data,
        });
        this.room.localParticipant.publishData(
            new TextEncoder().encode(payload),
            { reliable: true, topic: 'agent-control' }
        );
    }

    // Step 1: Start the LiveAvatar session and retrieve LiveKit credentials.
    // Does NOT connect to the room yet — call startSession() after setting callbacks.
    async initialize(sessionToken: string): Promise<void> {
        this.sessionToken = sessionToken;

        const startResp = await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/start`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!startResp.ok) {
            throw new Error(`Failed to start LiveAvatar session: ${startResp.statusText}`);
        }
        const startJson = await startResp.json();
        const { livekit_url, livekit_client_token } = startJson.data;
        this.livekitUrl = livekit_url;
        this.livekitToken = livekit_client_token;
    }

    // Step 2: Connect to the LiveKit room. Set all callbacks before calling this.
    async startSession(_config?: any): Promise<void> {
        if (!this.livekitUrl || !this.livekitToken) {
            throw new Error('[HeyGenService] startSession: call initialize() first');
        }

        this.room = new Room();

        // Avatar video/audio tracks
        this.room.on(RoomEvent.TrackSubscribed, (track, _publication, _participant) => {
            if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                if (!this.mediaStream) {
                    this.mediaStream = new MediaStream();
                }
                this.mediaStream.addTrack(track.mediaStreamTrack);
                if (this.onStreamReady) {
                    this.onStreamReady(this.mediaStream);
                }
            }
        });

        // Server events from agent-response topic
        this.room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
            if (topic !== 'agent-response') return;
            try {
                const event = JSON.parse(new TextDecoder().decode(payload));
                if (this.onAvatarEvent) this.onAvatarEvent(event);

                switch (event.event_type) {
                    case 'avatar.speak_started':
                        if (this.onAvatarStartTalking) this.onAvatarStartTalking(0);
                        break;
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
            } catch (e) {
                console.error('[HeyGenService] Failed to parse server event:', e);
            }
        });

        this.room.on(RoomEvent.Disconnected, () => {
            if (this.onDisconnected) this.onDisconnected();
        });

        await this.room.connect(this.livekitUrl, this.livekitToken);
    }

    async speak(text: string): Promise<void> {
        if (!this.room) throw new Error('[HeyGenService] speak: not initialized');
        this.sendCommand('avatar.speak_text', { text });
    }

    async stopSpeaking(): Promise<void> {
        if (!this.room) {
            console.warn('[HeyGenService] stopSpeaking called but service not initialized');
            return;
        }
        this.sendCommand('avatar.interrupt');
    }

    async startListening(): Promise<void> {
        if (!this.room) throw new Error('[HeyGenService] startListening: not initialized');
        this.sendCommand('avatar.start_listening');
    }

    async stopListening(): Promise<void> {
        if (!this.room) throw new Error('[HeyGenService] stopListening: not initialized');
        this.sendCommand('avatar.stop_listening');
    }

    async close(): Promise<void> {
        if (this.room) {
            if (this.sessionToken) {
                try {
                    await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/stop`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${this.sessionToken}` },
                    });
                } catch (e) {
                    console.warn('[HeyGenService] Failed to stop session on server:', e);
                }
            }
            await this.room.disconnect();
            this.room = null;
        }
        this.sessionToken = null;
        this.livekitUrl = null;
        this.livekitToken = null;
        this.mediaStream = null;
    }
}
