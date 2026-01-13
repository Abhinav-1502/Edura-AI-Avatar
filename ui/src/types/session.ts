export type SessionPartType = 'speech' | 'video';

export interface BaseSessionPart {
    id: number;
    type: SessionPartType;
}

export interface SpeechPart extends BaseSessionPart {
    type: 'speech';
    content: string;
}

export interface VideoPart extends BaseSessionPart {
    type: 'video';
    path: string;
    intro: string;
    outro: string;
}

export type SessionPart = SpeechPart | VideoPart;

export interface Session {
    id: string;
    title: string;
    subject?: string;
    numberOfParts?: number;
    script: SessionPart[];
}
