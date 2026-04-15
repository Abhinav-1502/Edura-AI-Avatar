/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SessionPart } from '../types/session';
import { HeyGenService } from '../services/HeyGenService';
import { ApiClient } from '../services/ApiClient';

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
    cachedAudioPath?: string;
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
    PAUSED: 'PAUSED',
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
            actions.push({ id: `${node.id}-speech`, type: ActionType.SPEAK, payload: node.content, cachedAudioPath: node.audio, originalNodeId: node.id, originalPart: node });
        } else if (node.type === 'video') {
            if (node.intro) {
                actions.push({ id: `${node.id}-intro`, type: ActionType.SPEAK, payload: node.intro, cachedAudioPath: node.intro_audio, originalNodeId: node.id, originalPart: node });
            }
            actions.push({ id: `${node.id}-video`, type: ActionType.VIDEO, payload: node.path, originalNodeId: node.id, originalPart: node });
            if (node.outro) {
                actions.push({ id: `${node.id}-outro`, type: ActionType.SPEAK, payload: node.outro, cachedAudioPath: node.outro_audio, originalNodeId: node.id, originalPart: node });
            }
        }
        if (node.wait) {
            actions.push({ id: `${node.id}-wait`, type: ActionType.WAIT, payload: node.wait.toString(), originalNodeId: node.id, originalPart: node });
        }
    });
    return actions;
};

interface UseLessonEngineProps {
    script: SessionPart[];
    avatarService: HeyGenService | null;
    onVideoPlay: (path: string) => void;
    onScriptComplete?: () => void;
}

export const useLessonEngine = ({
    script,
    avatarService,
    onVideoPlay,
    onScriptComplete
}: UseLessonEngineProps) => {
    const [actions, setActions] = useState<LessonAction[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [state, setState] = useState<LessonStateEnum>(LessonState.IDLE);
    
    // Track execution to prevent duplicate calls
    const executionRef = useRef<number | null>(null);
    const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Prefetch: cache for the next SPEAK action's audio
    const prefetchCacheRef = useRef<{ actionId: string; promise: Promise<string> } | null>(null);

    const advance = useCallback(() => {
        setCurrentIndex(prev => prev + 1);
    }, []);

    useEffect(() => {
        const flat = flattenScript(script);
        setActions(flat);
        setCurrentIndex(0);
        setState(LessonState.IDLE);
    }, [script]);

    // Fetch audio for a given action (cached path or live TTS)
    const fetchAudioForAction = useCallback((action: LessonAction): Promise<string> => {
        if (action.cachedAudioPath) {
            return ApiClient.getCachedAudio(action.cachedAudioPath);
        }
        return ApiClient.getTtsAudio(action.payload);
    }, []);

    // Kick off a prefetch for the next SPEAK action after `fromIndex`
    const prefetchNext = useCallback((fromIndex: number) => {
        for (let i = fromIndex + 1; i < actions.length; i++) {
            if (actions[i].type === ActionType.SPEAK) {
                const next = actions[i];
                // Don't re-prefetch if already cached for this action
                if (prefetchCacheRef.current?.actionId === next.id) return;
                console.log('[useLessonEngine] Prefetching audio for next SPEAK:', next.payload.substring(0, 60) + '...');
                prefetchCacheRef.current = {
                    actionId: next.id,
                    promise: fetchAudioForAction(next),
                };
                return;
            }
        }
    }, [actions, fetchAudioForAction]);

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
                let audioBase64: string;

                // Check prefetch cache first
                if (prefetchCacheRef.current?.actionId === action.id) {
                    console.log('[useLessonEngine] Prefetch HIT for:', action.payload.substring(0, 60) + '...');
                    audioBase64 = await prefetchCacheRef.current.promise;
                    prefetchCacheRef.current = null;
                } else {
                    // No prefetch available — fetch now
                    prefetchCacheRef.current = null;
                    if (action.cachedAudioPath) {
                        console.log('[useLessonEngine] Using cached audio:', action.cachedAudioPath);
                    } else {
                        console.log('[useLessonEngine] Fetching live TTS for:', action.payload.substring(0, 60) + '...');
                    }
                    audioBase64 = await fetchAudioForAction(action);
                }

                await avatarService.speak(audioBase64);

                // While avatar speaks this chunk, prefetch the next SPEAK action's audio
                prefetchNext(currentIndex);

                // We DO NOT advance here. We wait for 'avatar_stop_talking' event.
             } catch(e) {
                 console.error("Speak failed", e);
             }
        } else if (action.type === ActionType.VIDEO) {
             onVideoPlay(action.payload);
             // We DO NOT advance here. We wait for onVideoEnded callback.
        } else if (action.type === ActionType.WAIT) {
             const seconds = parseInt(action.payload) || 0;
             console.log(`[useLessonEngine] Waiting for ${seconds} seconds...`);
             if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
             waitTimeoutRef.current = setTimeout(() => {
                 if (state === LessonState.RUNNING && executionRef.current === currentIndex) {
                     advance();
                 }
             }, seconds * 1000);
        }

    }, [actions, currentIndex, avatarService, onVideoPlay, onScriptComplete, state, advance]);

    const startLesson = useCallback((startActionIndex: number = 0) => {
        console.log(`[useLessonEngine] startLesson called with startActionIndex: ${startActionIndex}`);
        setState(LessonState.RUNNING);
        
        if (startActionIndex > 0 && startActionIndex < actions.length) {
             console.log(`[useLessonEngine] Resuming at action index: ${startActionIndex}`);
             setCurrentIndex(startActionIndex);
        } else {
             if (startActionIndex >= actions.length) {
                 console.warn(`[useLessonEngine] startActionIndex ${startActionIndex} out of bounds (max ${actions.length}). Starting at 0.`);
             }
             setCurrentIndex(0);
        }

        executionRef.current = null;
    }, [actions]);

    // Trigger execution when index/state changes
    useEffect(() => {
        if (state === LessonState.RUNNING) {
            // We use a timeout to break the synchronous setState cycle if needed, 
            // but strict mode might still complain. Ideally we don't call side effects in render.
            // But this is an effect, so it's fine.
            executeCurrentAction();
        }
    }, [currentIndex, state, executeCurrentAction]);

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

    const interrupt = useCallback(async () => {
        // Interrupting puts us in WAITING state.
        // We stop speaking. The TalkingStopped event will fire but should be ignored by App.tsx logic because of this state.
        setState(LessonState.WAITING_FOR_INPUT);
        prefetchCacheRef.current = null;
        if (waitTimeoutRef.current) {
            clearTimeout(waitTimeoutRef.current);
            waitTimeoutRef.current = null;
        }
        await avatarService?.stopSpeaking();
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

    const getStartActionIndexForPartId = useCallback((partId: number) => {
        return actions.findIndex(a => a.originalNodeId === partId);
    }, [actions]);

    const pause = useCallback(async () => {
        setState(LessonState.PAUSED);
        prefetchCacheRef.current = null;
        if (waitTimeoutRef.current) {
            clearTimeout(waitTimeoutRef.current);
            waitTimeoutRef.current = null;
        }
        await avatarService?.stopSpeaking();
    }, [avatarService]);

    useEffect(() => {
        return () => {
            if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
        };
    }, []);

    return useMemo(() => ({
        state,
        currentAction: actions[currentIndex],
        currentPartId: actions[currentIndex]?.originalNodeId,
        startLesson,
        onAvatarSpeechEnded,
        onVideoEnded,
        interrupt,
        skip,
        pause,
        startAnswering,
        signalAnswerComplete,
        resume,
        getContextSlice,
        getStartActionIndexForPartId,
        isReady: actions.length > 0
    }), [state, actions, currentIndex, startLesson, onAvatarSpeechEnded, onVideoEnded, interrupt, skip, pause, startAnswering, signalAnswerComplete, resume, getContextSlice, getStartActionIndexForPartId]);
};
