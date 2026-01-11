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
        // Assuming BASE_URL is meant to be empty or the host is implied by the relative path.
        // If BASE_URL is truly needed, it should be initialized appropriately.
        // For consistency with other relative paths, let's assume it should be `/api/heygen/token` directly.
        // However, strictly following the provided snippet, it uses `this.BASE_URL`.
        // If `this.BASE_URL` is not explicitly defined elsewhere, it would be `undefined`.
        // To make the provided snippet syntactically correct and functional,
        // I will assume `this.BASE_URL` should be an empty string or removed if the path is relative.
        // Given the other methods use relative paths, I will adjust the fetch call to be relative.
        const response = await fetch(`${this.BASE_URL}/api/heygen/token`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to get HeyGen token');
        const json = await response.json();
        return json.data.token;
    }



    async getSystemPrompt(): Promise<string> {
        try {
            const response = await fetch('/api/get-system-prompt');
            const data = await response.json();
            return data.systemPrompt;
        } catch (error) {
            console.error("Failed to fetch system prompt:", error);
            return "You are an AI assistant that helps people find information.";
        }
    }

    async getTopics(): Promise<Topic[]> {
        const response = await fetch('/api/topics');
        if (!response.ok) throw new Error('Failed to fetch topics');
        return response.json();
    }

    async getTopicDetails(topicId: string): Promise<Topic> {
         const response = await fetch(`/api/topics/${topicId}`);
         if (!response.ok) throw new Error('Failed to fetch topic details');
         return response.json();
    }

    async getSession(): Promise<Session> {
        const response = await fetch(`/api/session?_=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        return response.json();
    }

    async sendChatRequest(messages: Message[], dataSources: any[], oydEnabled: boolean): Promise<Response> {
        const url = '/api/chat';
        const body = JSON.stringify({ messages, useSearch: oydEnabled, dataSources: oydEnabled ? dataSources : [] });
        
        return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
    }
}

export const ApiClient = new ApiClientService();
