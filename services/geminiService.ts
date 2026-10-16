
import type { Content } from "@google/genai";

export const generateFeedPost = async (idea: string): Promise<{ title: string; body: string; hashtags: string[]; imagePrompt: string } | null> => {
    try {
        const response = await fetch('/api/gemini/feed-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea }),
        });
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error generating feed post:", error);
        return null;
    }
};

export const generateChatSummary = async (
    transcript: string,
    options?: { title?: string; conversationType?: 'inbox' | 'team'; periodLabel?: string }
): Promise<string> => {
    if (!transcript.trim()) {
        return "The chat is empty. Nothing to summarize.";
    }
    const response = await fetch('/api/gemini/chat-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transcript,
            title: options?.title,
            conversationType: options?.conversationType,
            periodLabel: options?.periodLabel,
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.summary || `Server error (${response.status})`);
    }
    const data = await response.json();
    return data.summary || "No summary generated.";
};

export const generateSummary = async (text: string): Promise<string> => {
    try {
        const response = await fetch('/api/gemini/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return err.summary || "Could not generate summary.";
        }
        const data = await response.json();
        return data.summary || "Could not generate summary.";
    } catch (error) {
        console.error("Error generating summary:", error);
        return "Could not generate summary.";
    }
};

interface CardContext {
    title: string;
    content: string;
    author: string;
}

export const getAIChatResponseStream = (
    history: Content[],
    context: CardContext | null,
    useSearch: boolean,
    onChunk: (chunk: { text: string; sources?: any[] }) => void,
    onError: (error: string) => void,
    onComplete: () => void
): { cancel: () => void } => {
    const abortController = new AbortController();
    let isCancelled = false;

    const runStream = async () => {
        try {
            const response = await fetch('/api/gemini/chat-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    history,
                    context,
                    useSearch,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || `Server returned HTTP ${response.status}`);
            }

            if (!response.body) {
                throw new Error('ReadableStream not supported on response.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (!isCancelled) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const trimmed = part.trim();
                    if (!trimmed) continue;

                    if (trimmed.startsWith('event: error')) {
                        const dataLine = trimmed.split('\n').find(l => l.startsWith('data: '));
                        const errMsg = dataLine ? JSON.parse(dataLine.slice(6)).error : 'An error occurred';
                        if (!isCancelled) onError(errMsg);
                        return;
                    }

                    if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.slice(6);
                        if (dataStr === '[DONE]') {
                            if (!isCancelled) onComplete();
                            return;
                        }
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (!isCancelled) {
                                onChunk({ text: parsed.text || '', sources: parsed.sources });
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data chunk:', e, dataStr);
                        }
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || isCancelled) {
                return;
            }
            console.error('Error getting AI chat response:', error);
            if (!isCancelled) {
                onError(error.message || 'Sorry, I encountered an error. Please try again.');
            }
        } finally {
            if (!isCancelled && !abortController.signal.aborted) {
                onComplete();
            }
        }
    };

    runStream();

    return {
        cancel: () => {
            isCancelled = true;
            abortController.abort();
        },
    };
};
