/* eslint-disable @typescript-eslint/no-explicit-any */
import StreamingAvatar, { 
    AvatarQuality, 
    TaskType, 
    type StartAvatarRequest,
} from "@heygen/streaming-avatar";

export interface HeyGenConfig {
    quality?: AvatarQuality;
    knowledgeId?: string;
    disableIdleTimeout?: boolean;
}

export class HeyGenService {
    private avatar: StreamingAvatar | null = null;
    private sessionData: any = null;
    
    // Callbacks
    public onAvatarStartTalking?: (headId: number) => void;
    public onAvatarStopTalking?: (headId: number) => void;
    public onUserStartTalking?: (text: string) => void;
    public onUserStopTalking?: (text: string) => void;
    public onStreamReady?: (stream: MediaStream) => void;
    public onDisconnected?: () => void;
    public onAvatarEvent?: (event: any) => void;

    private eventHandler = (event: any) => {
        // Notify generic handler
        if (this.onAvatarEvent) {
             this.onAvatarEvent(event);
        }

        switch (event.type) {
            case "avatar_start_talking":
                 if (this.onAvatarStartTalking) this.onAvatarStartTalking(event.detail?.id);
                 break;
            case "avatar_stop_talking":
                 if (this.onAvatarStopTalking) this.onAvatarStopTalking(event.detail?.id);
                 break;
            case "user_start":
                 if (this.onUserStartTalking) this.onUserStartTalking(event.detail?.text);
                 break;
            case "user_stop":
                 if (this.onUserStopTalking) this.onUserStopTalking(event.detail?.text);
                 break;
            case "stream_ready":
                 if (this.onStreamReady) this.onStreamReady(event.detail);
                 break;
            case "stream_disconnected":
                 if (this.onDisconnected) this.onDisconnected();
                 break;
        }
    }

    async initialize(token: string): Promise<void> {
        this.avatar = new StreamingAvatar({
            token: token
        });
        
        // Register events
        this.avatar.on("avatar_start_talking", (e) => this.eventHandler({type: "avatar_start_talking", detail: e}));
        this.avatar.on("avatar_stop_talking", (e) => this.eventHandler({type: "avatar_stop_talking", detail: e}));
        this.avatar.on("user_start", (e) => this.eventHandler({type: "user_start", detail: e}));
        this.avatar.on("user_stop", (e) => this.eventHandler({type: "user_stop", detail: e}));
        this.avatar.on("stream_ready", (e) => this.eventHandler({type: "stream_ready", detail: e.detail}));
        this.avatar.on("stream_disconnected", (e) => this.eventHandler({type: "stream_disconnected", detail: e.detail}));
    }

    async startSession(config: StartAvatarRequest): Promise<void> {
        if (!this.avatar) throw new Error("HeyGenService not initialized");
        
        this.sessionData = await this.avatar.createStartAvatar(config);


    }

    async speak(text: string, taskType: TaskType = TaskType.REPEAT): Promise<void> {
        if (!this.avatar) throw new Error("HeyGenService not initialized");
        await this.avatar.speak({ text, task_type: taskType });
    }

    async stopSpeaking(): Promise<void> {
         if (!this.avatar) return;
         await this.avatar.interrupt();
    }

    async startListening(): Promise<void> {
        if (!this.avatar) return;
        await this.avatar.startVoiceChat();
    }

    async stopListening(): Promise<void> {
        if (!this.avatar) return;
        await this.avatar.closeVoiceChat();
    }

    async close(): Promise<void> {
        if (this.avatar) {
            await this.avatar.stopAvatar();
            this.avatar = null;
        }
    }
}
