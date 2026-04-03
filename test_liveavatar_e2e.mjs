/**
 * End-to-end test: Backend token → LiveAvatar session start → TTS → send audio via WebSocket
 *
 * Usage:  node test_liveavatar_e2e.mjs
 * Requires: Node 22+ (native fetch + WebSocket)
 */

const BACKEND = 'http://localhost:8000';
const LIVEAVATAR_API = 'https://api.liveavatar.com';
const TEST_TEXT = 'Hello students, welcome to today\'s lesson on prepositions.';

function log(step, msg, data) {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[${ts}] [${step}]`, msg, data !== undefined ? data : '');
}

async function run() {
    // ── Step 1: Get session token from backend (sandbox mode) ──────────────
    log('1-TOKEN', 'Requesting session token from backend...');
    const tokenResp = await fetch(`${BACKEND}/api/heygen/token`, { method: 'POST' });
    if (!tokenResp.ok) throw new Error(`Token request failed: ${tokenResp.status}`);
    const tokenJson = await tokenResp.json();
    const sessionToken = tokenJson.data.session_token;
    const sessionId = tokenJson.data.session_id;
    log('1-TOKEN', `session_id: ${sessionId}`);
    log('1-TOKEN', `session_token: ${sessionToken.slice(0, 40)}...`);

    // ── Step 2: Start session on LiveAvatar API ────────────────────────────
    log('2-START', 'Calling LiveAvatar /v1/sessions/start...');
    const startResp = await fetch(`${LIVEAVATAR_API}/v1/sessions/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!startResp.ok) {
        const body = await startResp.text();
        throw new Error(`sessions/start failed: ${startResp.status} — ${body}`);
    }
    const startJson = await startResp.json();
    const d = startJson.data ?? startJson;
    const wsUrl = d.ws_url;
    const livekitUrl = d.livekit_url;
    log('2-START', 'livekit_url:', livekitUrl ?? 'MISSING');
    log('2-START', 'ws_url:', wsUrl ?? 'NOT PROVIDED');
    log('2-START', 'Full start response keys:', Object.keys(d).join(', '));

    if (!wsUrl) {
        log('2-START', 'No ws_url — LITE audio commands will not work. Aborting test.');
        // Still try to stop the session cleanly
        await fetch(`${LIVEAVATAR_API}/v1/sessions/stop`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
        });
        process.exit(1);
    }

    // ── Step 3: Get TTS audio from backend (ElevenLabs) ────────────────────
    log('3-TTS', `Requesting TTS for: "${TEST_TEXT.slice(0, 50)}..."`);
    const ttsResp = await fetch(`${BACKEND}/api/heygen/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: TEST_TEXT }),
    });
    if (!ttsResp.ok) {
        const body = await ttsResp.text();
        throw new Error(`TTS failed: ${ttsResp.status} — ${body}`);
    }
    const ttsJson = await ttsResp.json();
    const audioBase64 = ttsJson.audio_base64;
    log('3-TTS', `Got audio: ${audioBase64.length} base64 chars (~${Math.round(audioBase64.length * 0.75 / 1024)} KB PCM)`);

    // ── Step 4: Connect WebSocket and send audio ───────────────────────────
    log('4-WS', 'Connecting to LiveAvatar WebSocket:', wsUrl);

    await new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const events = [];
        let speakSent = false;

        const timeout = setTimeout(() => {
            log('4-WS', 'Timeout — closing. Events received:', events.length);
            ws.close();
            resolve();
        }, 15000);

        ws.onopen = () => {
            log('4-WS', 'WebSocket connected');

            // Send audio
            const eventId = crypto.randomUUID();
            log('5-SPEAK', `Sending agent.speak (${audioBase64.length} chars) + agent.speak_end (event_id: ${eventId})`);
            ws.send(JSON.stringify({ type: 'agent.speak', audio: audioBase64 }));
            ws.send(JSON.stringify({ type: 'agent.speak_end', event_id: eventId }));
            speakSent = true;
            log('5-SPEAK', 'Audio sent! Waiting for server events...');
        };

        ws.onmessage = (evt) => {
            try {
                const event = JSON.parse(evt.data);
                events.push(event);
                const type = event.type ?? event.event_type ?? 'unknown';
                log('EVENT', type, JSON.stringify(event).slice(0, 200));

                // If we see speak_ended after sending, test is successful
                if (speakSent && (type === 'agent.speak_ended' || type === 'avatar.speak_ended')) {
                    log('RESULT', 'avatar finished speaking — audio delivery confirmed!');
                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                }
            } catch (e) {
                log('EVENT', 'Parse error:', e.message);
            }
        };

        ws.onerror = (err) => {
            log('4-WS', 'WebSocket error:', err.message ?? err);
            clearTimeout(timeout);
            reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = (evt) => {
            log('4-WS', `WebSocket closed: code=${evt.code} reason=${evt.reason}`);
            clearTimeout(timeout);
            resolve();
        };
    });

    // ── Step 6: Stop session ───────────────────────────────────────────────
    log('6-STOP', 'Stopping session...');
    const stopResp = await fetch(`${LIVEAVATAR_API}/v1/sessions/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
    });
    log('6-STOP', `Stop response: ${stopResp.status}`);

    log('DONE', 'End-to-end test complete.');
}

run().catch(err => {
    console.error('\n TEST FAILED:', err.message);
    process.exit(1);
});
