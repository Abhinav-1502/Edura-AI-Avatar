/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Session } from '../types/session';


export interface Message {
    role: string;
    content: string;
}

export interface ScriptNode {
    id: number;
    type: 'speech' | 'video';
    content?: string;
    path?: string;
    intro?: string;
    outro?: string;
}

export interface SessionHistory {
    id: string;
    sessionId: string;
    completedParts: number;
    postedHomework: boolean;
    createdAt: string;
}

export interface Topic {
    id: string;
    title: string;
    script: ScriptNode[];
}

class ApiClientService {
    // Assuming BASE_URL is needed for the new static method,
    // though other methods use relative paths.
    // If all methods are intended to be static, this would be ApiClientService.BASE_URL
    // For now, keeping it as an instance property if other methods remain instance methods.
    
    // However, the provided snippet makes getHeyGenToken and getSpeechToken static.
    // Let's make BASE_URL static to match the snippet's usage.
    private BASE_URL = import.meta.env.BACKEND_URL || 'http://localhost:8000'; // Or set to window.location.origin if needed

    async getHeyGenToken(): Promise<string> {
        const response = await fetch(`${this.BASE_URL}/api/heygen/token`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to get HeyGen token');
        const json = await response.json();
        return json.data.token;
    }

    async getHeyGenAvatarList(): Promise<any> {
        const response = await fetch(`${this.BASE_URL}/api/heygen/avatar_list`);
        if (!response.ok) throw new Error('Failed to get HeyGen avatar list');
        const json = await response.json();
        return json.data;
    }

    async getHeyGenCredits(): Promise<any> {
        const response = await fetch(`${this.BASE_URL}/api/heygen/available_credits`);
        if (!response.ok) throw new Error('Failed to get HeyGen available credits');
        const json = await response.json();
        return json.data;
    }

    async stopAllActiveSession(): Promise<any> {
        const response = await fetch(`${this.BASE_URL}/api/heygen/stop_all_sessions`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to stop all active sessions');
        const json = await response.json();
        return json.data;
    }

    async uploadBackgroundImage(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.BASE_URL}/api/config/upload_background`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Failed to upload background image');
        const json = await response.json();
        return json.url;
    }



    async getBackgroundUrl(): Promise<string | null> {
        try {
            const response = await fetch(`${this.BASE_URL}/api/config/background`);
            if (!response.ok) return null;
            const json = await response.json();
            return json.url ? `${this.BASE_URL}${json.url}` : null;
        } catch (error) {
            console.error("Failed to fetch background url:", error);
            return null;
        }
    }

    async getSystemPrompt(): Promise<string> {
        try {
            const response = await fetch(`${this.BASE_URL}/api/get-system-prompt`);
            const data = await response.json();
            return data.systemPrompt;
        } catch (error) {
            console.error("Failed to fetch system prompt:", error);
            return "You are an AI assistant that helps people find information.";
        }
    }

    async getTopics(): Promise<Topic[]> {
        const response = await fetch(`${this.BASE_URL}/api/topics`);
        if (!response.ok) throw new Error('Failed to fetch topics');
        return response.json();
    }

    async getTopicDetails(topicId: string): Promise<Topic> {
         const response = await fetch(`${this.BASE_URL}/api/topics/${topicId}`);
         if (!response.ok) throw new Error('Failed to fetch topic details');
         return response.json();
    }

    async getSessions(): Promise<any[]> {
        const response = await fetch(`${this.BASE_URL}/api/sessions`);
        if (!response.ok) throw new Error('Failed to fetch sessions');
        return response.json();
    }

    async getSession(sessionId: string): Promise<Session> {
        const response = await fetch(`${this.BASE_URL}/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        return response.json();
    }
    async postHomework(sessionId: string): Promise<any> {
        const response = await fetch(`${this.BASE_URL}/api/sessions/post_homework/${sessionId}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to post homework');
        return response.json();
    }
    async sendChatRequest(messages: Message[], dataSources: any[], oydEnabled: boolean): Promise<Response> {
        const url = `${this.BASE_URL}/api/chat`;
        const body = JSON.stringify({ messages, useSearch: oydEnabled, dataSources: oydEnabled ? dataSources : [] });
        
        return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
    }
    async saveSessionHistory(history: SessionHistory): Promise<any> {
        const response = await fetch(`${this.BASE_URL}/api/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(history)
        });
        if (!response.ok) throw new Error('Failed to save session history');
        return response.json();
    }

    async getSessionHistory(sessionId: string): Promise<SessionHistory[]> {
        const response = await fetch(`${this.BASE_URL}/api/history/${sessionId}`);
        if (!response.ok) return []; 
        return response.json();
    }

    async getAllSessionHistory(): Promise<SessionHistory[]> {
        const response = await fetch(`${this.BASE_URL}/api/history`);
        if (!response.ok) return []; 
        return response.json();
    }
}

export const ApiClient = new ApiClientService();
