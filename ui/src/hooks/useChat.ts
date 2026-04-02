import { useState, useCallback } from 'react';
import { ApiClient } from '../services/ApiClient';
import type { Message } from '../services/ApiClient';

const sentenceLevelPunctuations = ['.', '?', '!', ':', ';', '。', '？', '！', '：', '；'];
const byodDocRegex = new RegExp(/\[doc(\d+)\]/g);

interface UseChatProps {
    onSpeak: (text: string) => void;
    oydEnabled: boolean;
}

export const useChat = ({ onSpeak, oydEnabled }: UseChatProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [exampleText, setExampleText] = useState<string>('');
    
    // We need refs to access latest state in async callbacks if we were using closures, 
    // but here we just update state or triggers.

    const clearMessages = useCallback(async () => {
        const prompt = await ApiClient.getSystemPrompt();
        setMessages([{ role: 'system', content: prompt }]);
        setExampleText('');
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        // Add user message immediately
        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setExampleText('');
        
        setIsLoading(true);

        // const currentMessages = [...messages, userMsg]; // We separate presentation from logic sometimes
        // Actually 'messages' state might be stale here if we don't use functional update or ref.
        // But cleaner is to use the functional update pattern or just pass the array if we have it.
        // Wait, 'messages' from state is a dependency.
        
        // Prepare data sources
        const dataSources = oydEnabled ? [{}] : []; // Dummy if enabled, as per original code

        let assistantReply = '';
        let toolContent = '';
        let spokenSentence = '';

        try {
            // We need to fetch sys prompt if empty? Assume initialized.
            // Re-construct full conversation for API:
            // The API expects the full history including system prompt.
            // However, `messages` state might not be updated yet in this closure if we didn't add it to dependency.
            // Best to use a ref for messages or trust the 'messages' dependency is updated (creates new function).
            
            // Actually, we can just append the new message to the list we *know* we have.
            const payloadMessages = [...messages, userMsg];

            const response = await ApiClient.sendChatRequest(payloadMessages, dataSources, oydEnabled);
            
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            const processLine = (line: string) => {
                 if (!line.startsWith('data:')) return;
                 // Handle [DONE]
                 if (line.includes('[DONE]')) return;

                 try {
                     const jsonStr = line.substring(5).trim();
                     if (!jsonStr) return;
                     
                     const json = JSON.parse(jsonStr);
                     if (json.error) {
                         console.error("Backend LLM Stream Error:", json.error);
                         return;
                     }
                     const choice = json.choices?.[0];
                     
                     let token = '';
                     // OYD Check
                     if (choice?.messages?.[0]?.delta) {
                         const msg = choice.messages[0].delta;
                         if (msg.role === 'tool') {
                            toolContent = msg.content;
                         } else {
                             token = msg.content || '';
                             if (token && byodDocRegex.test(token)) token = token.replace(byodDocRegex, '').trim();
                         }
                     } else if (choice?.delta?.content) {
                         token = choice.delta.content;
                     }

                         if (token) {
                             assistantReply += token;

                             // Check for Example tag
                             const exampleMatch = assistantReply.match(/<<<EXAMPLE:([\s\S]*?)>>>/);
                             if (exampleMatch) {
                                  setExampleText(exampleMatch[1].trim());
                             } else {
                                 // Handle incomplete tag or start
                                 const startTag = "<<<EXAMPLE:";
                                 const startIndex = assistantReply.lastIndexOf(startTag);
                                 if (startIndex !== -1 && !assistantReply.includes(">>>", startIndex)) {
                                     // We are potentially inside an example tag, streaming it.
                                     // We can show partial content if we want, or wait.
                                     // Let's show partial for effect?
                                     // The regex above catches closed tags.
                                     // For streaming effect:
                                     const partialContent = assistantReply.substring(startIndex + startTag.length);
                                     setExampleText(partialContent);
                                 }
                             }
                             
                             // Update UI with partial message?
                         // Ideally we stream this to UI. 
                         // For simplicity, we can update state periodically or wait.
                         // But for "Chat" we want to see it typing.
                         // We'll update state at the end or use a separate "streamingMessage" state.
                         // Updating 'messages' constantly causes re-renders. 
                         // We can use a ref for the current assistant message and force update?
                         setMessages(prev => {
                             const last = prev[prev.length - 1];
                             if (last.role === 'assistant') {
                                 return [...prev.slice(0, -1), { ...last, content: assistantReply }];
                             } else {
                                 return [...prev, { role: 'assistant', content: assistantReply }];
                             }
                         });

                         // TTS Logic
                         if (['\n', '\n\n'].includes(token)) {
                             spokenSentence += token;
                             // Don't speak on newlines alone unless it forms a sentence
                             if (spokenSentence.trim().length > 0 && /[.?!;:]/.test(spokenSentence)) {
                                 onSpeak(spokenSentence);
                                 spokenSentence = '';
                             }
                         } else {
                             spokenSentence += token;
                             // Check for sentence delimiters more aggressively
                             if (/[.?!;:]/.test(token) || (spokenSentence.length > 50 && /[,—]/.test(token))) {
                                 const lastChar = spokenSentence.trim().slice(-1);
                                 // Basic heuristic: if it looks like the end of a sentence
                                 if (sentenceLevelPunctuations.includes(lastChar)) {
                                      if (spokenSentence.trim()) {
                                         onSpeak(spokenSentence);
                                         spokenSentence = '';
                                      }
                                 }
                             }
                         }
                     }
                 } catch (e) {
                     console.error("Parse error", e);
                 }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim()) {
                        // Residual
                         const parts = buffer.split('\n');
                         parts.forEach(part => processLine(part.trim()));
                    }
                    break;
                }
                
                const text = decoder.decode(value, { stream: true });
                buffer += text;
                const parts = buffer.split('\n');
                buffer = parts.pop() || '';
                parts.forEach(part => processLine(part.trim()));
            }

            if (spokenSentence.trim()) {
                onSpeak(spokenSentence);
            }
            
            // Final consistency update
            setMessages(prev => {
                const msgs = [...prev];
                // Should basically match assistantReply.
                // If toolContent exists, add it.
                if (toolContent) msgs.push({ role: 'tool', content: toolContent });
                return msgs;
            });

        } catch (e) {
            console.error("Chat error:", e);
            alert("Chat error: " + (e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [messages, oydEnabled, onSpeak]);

    return {
        messages,
        sendMessage,
        clearMessages,
        isLoading,
        exampleText,
        setMessages // Expose this to manually set context
    };
};
