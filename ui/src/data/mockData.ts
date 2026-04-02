import { Session, SessionHistory, SessionScript, ScriptType } from '../../models/session';

const dummyScript: SessionScript[] = [
    {
        id: "1",
        title: "Part 1",
        script: [
            {
                id: "s1",
                type: ScriptType.Speech,
                content: "Hello! Welcome to our session on prepositions."
            }
        ]
    }
];

export const MOCK_SESSIONS: Session[] = [
    {
        id: "preposition_1001",
        title: "Introduction to Prepositions",
        subject: "English Grammar",
        numberOfParts: 3,
        script: dummyScript
    },
    {
        id: "s_002",
        title: "Advanced React Patterns",
        subject: "Computer Science",
        numberOfParts: 5,
        script: dummyScript
    },
    {
        id: "s_003",
        title: "History of the Roman Empire",
        subject: "History",
        numberOfParts: 2,
        script: dummyScript
    }
];

export const MOCK_HISTORY: SessionHistory[] = [
    {
        id: "h_001",
        sessionId: "s_001",
        completedParts: 3,
        postedHomework: true,
        createdAt: new Date("2025-12-25T10:00:00")
    },
    {
        id: "h_002",
        sessionId: "s_002",
        completedParts: 2,
        postedHomework: false,
        createdAt: new Date("2026-01-05T14:30:00")
    }
];
