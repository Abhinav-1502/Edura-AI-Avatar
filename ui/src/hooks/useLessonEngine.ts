import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SessionPart } from '../types/session';
import { HeyGenService } from '../services/HeyGenService';

export const ActionType = {
    SPEAK: 'SPEAK',
    VIDEO: 'VIDEO',
    WAIT: 'WAIT'
} as const;

export type ActionTypeEnum = typeof ActionType[keyof typeof ActionType];

export interface LessonAction {
    id: string;
    type: ActionTypeEnum;
    payload: string;
    originalNodeId: number;
    originalPart: SessionPart;
}

export const LessonState = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    WAITING_FOR_INPUT: 'WAITING_FOR_INPUT',
    ANSWERING: 'ANSWERING',
    ANSWER_COMPLETE: 'ANSWER_COMPLETE',
    PAUSED_FOR_QA: 'PAUSED_FOR_QA',
    COMPLETED: 'COMPLETED'
} as const;

export type LessonStateEnum = typeof LessonState[keyof typeof LessonState];

const flattenScript = (nodes: SessionPart[]): LessonAction[] => {
    if (!Array.isArray(nodes)) {
        console.error("flattenScript received non-array:", nodes);
        return [];
    }
    const actions: LessonAction[] = [];
    nodes.forEach(node => {
        if (node.type === 'speech') {
            actions.push({ id: `${node.id}-speech`, type: ActionType.SPEAK, payload: node.content, originalNodeId: node.id, originalPart: node });
        } else if (node.type === 'video') {
            if (node.intro) {
                actions.push({ id: `${node.id}-intro`, type: ActionType.SPEAK, payload: node.intro, originalNodeId: node.id, originalPart: node });
            }
            actions.push({ id: `${node.id}-video`, type: ActionType.VIDEO, payload: node.path, originalNodeId: node.id, originalPart: node });
            if (node.outro) {
                actions.push({ id: `${node.id}-outro`, type: ActionType.SPEAK, payload: node.outro, originalNodeId: node.id, originalPart: node });
            }
        }
    });
    return actions;
};

interface UseLessonEngineProps {
    script: SessionPart[];
    avatarService: HeyGenService | null;
    voiceName: string;
    onVideoPlay: (path: string) => void;
    onScriptComplete?: () => void;
}

export const useLessonEngine = ({
    script,
    avatarService,
    voiceName,
    onVideoPlay,
    onScriptComplete
}: UseLessonEngineProps) => {
    const [actions, setActions] = useState<LessonAction[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [state, setState] = useState<LessonStateEnum>(LessonState.IDLE);
    
    // Track execution to prevent duplicate calls
    const executionRef = useRef<number | null>(null);

    useEffect(() => {
        const flat = flattenScript(script);
        setActions(flat);
        setCurrentIndex(0);
        setState(LessonState.IDLE);
    }, [script]);

    const executeCurrentAction = useCallback(async () => {
        if (!avatarService || currentIndex >= actions.length) {
            if (currentIndex >= actions.length && actions.length > 0) {
                 setState(LessonState.COMPLETED);
                 if (onScriptComplete) onScriptComplete();
            }
            return;
        }

        const action = actions[currentIndex];
        
        // Prevent double execution of same index
        if (executionRef.current === currentIndex) return;
        executionRef.current = currentIndex;

        if (action.type === ActionType.SPEAK) {
             try {
                // Determine voice to use: preferred from script part, otherwise default from config
                await avatarService.speak(action.payload);
                // We DO NOT advance here. We wait for 'avatar_stop_talking' event (handled as TalkingStopped logic upstream or via callbacks).
             } catch(e) {
                 console.error("Speak failed", e);
             }
        } else if (action.type === ActionType.VIDEO) {
             onVideoPlay(action.payload);
             // We DO NOT advance here. We wait for onVideoEnded callback.
        }

    }, [actions, currentIndex, avatarService, onVideoPlay, onScriptComplete, voiceName]);

    const startLesson = useCallback(() => {
        setState(LessonState.RUNNING);
        setCurrentIndex(0);
        executionRef.current = null;
    }, []);

    // Trigger execution when index/state changes
    useEffect(() => {
        if (state === LessonState.RUNNING) {
            // We use a timeout to break the synchronous setState cycle if needed, 
            // but strict mode might still complain. Ideally we don't call side effects in render.
            // But this is an effect, so it's fine.
            executeCurrentAction();
        }
    }, [currentIndex, state, executeCurrentAction]);

    const advance = useCallback(() => {
        setCurrentIndex(prev => prev + 1);
    }, []);

    const onAvatarSpeechEnded = useCallback(() => {
        if (state !== LessonState.RUNNING) {
             return;
        }
        const action = actions[currentIndex];
        if (action && action.type === ActionType.SPEAK) {
            advance();
        } else {
             // Speech ended but not expected or handle other logic
        }
    }, [state, actions, currentIndex, advance]);

    const onVideoEnded = useCallback(() => {
        if (state !== LessonState.RUNNING) return;
        const action = actions[currentIndex];
        if (action && action.type === ActionType.VIDEO) {
            advance();
        }
    }, [state, actions, currentIndex, advance]);

    const interrupt = useCallback(() => {
        // Interrupting puts us in WAITING state.
        // We stop speaking. The TalkingStopped event will fire but should be ignored by App.tsx logic because of this state.
        setState(LessonState.WAITING_FOR_INPUT);
        avatarService?.stopSpeaking();
    }, [avatarService]);

    const skip = useCallback(() => {
        // Stop speaking, but DO NOT change state to PAUSED.
        // This will trigger TalkingStopped which advances the lesson.
        avatarService?.stopSpeaking();
    }, [avatarService]);

    const startAnswering = useCallback(() => {
        setState(LessonState.ANSWERING);
    }, []);

    const resume = useCallback(() => {
        setState(LessonState.RUNNING);
        executionRef.current = null; 
    }, []);

    const getContextSlice = useCallback(() => {
        if (!script || script.length === 0) return [];
        
        // Find current node index in original script based on current action
        const currentAction = actions[currentIndex];
        if (!currentAction) return [];

        const currentNodeIndex = script.findIndex(n => n.id === currentAction.originalNodeId);
        if (currentNodeIndex === -1) return [];

        const start = Math.max(0, currentNodeIndex - 4);
        const end = Math.min(script.length, currentNodeIndex + 3); // +5 because slice is exclusive

        return script.slice(start, end);
    }, [actions, currentIndex, script]);

    const signalAnswerComplete = useCallback(() => {
        setState(LessonState.ANSWER_COMPLETE);
    }, []);

    return useMemo(() => ({
        state,
        currentAction: actions[currentIndex],
        startLesson,
        onAvatarSpeechEnded,
        onVideoEnded,
        interrupt,
        skip,
        startAnswering,
        signalAnswerComplete,
        resume,
        getContextSlice
    }), [state, actions, currentIndex, startLesson, onAvatarSpeechEnded, onVideoEnded, interrupt, skip, startAnswering, signalAnswerComplete, resume, getContextSlice]);
};
