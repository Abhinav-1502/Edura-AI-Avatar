

export class Session {
    id: string = "";
    title: string = "";
    script: SessionScript[] = [];
    numberOfParts: number = 0;
    subject: string = "";
}


export class SessionScript{
    id: string = "";
    title: string = "";
    script: ScriptPart[] = [];
}
export class ScriptPart{
    id: string = "";
    type: ScriptType = ScriptType.Speech;
    content?: string = "";
    path?: string = "";
    intro?: string = "";
    outro?: string = "";
}

export class SessionHistory{
    id: string = "";
    sessionId: string = "";
    completedParts: number = 0;
    postedHomework: boolean = false;
    createdAt: Date = new Date();
}

export const ScriptType = {
    Speech: "speech",
    Video: "video"
} as const;

export type ScriptType = typeof ScriptType[keyof typeof ScriptType];
