
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Content } from "@google/genai";

// Assume process.env.API_KEY is configured in the environment
// FIX: Initialized GoogleGenAI with a named apiKey parameter as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateFeedPost = async (idea: string): Promise<{ title: string; body: string; hashtags: string[]; imagePrompt: string } | null> => {
    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name to 'gemini-3-flash-preview' for basic text generation tasks.
            model: "gemini-3-flash-preview",
            // FIX: Simplified the contents to be a single string prompt for a single-turn request.
            contents: `Based on the following user idea, generate a full feed post. The idea is: "${idea}".`,
            config: {
                // FIX: Setting thinkingBudget to 0 to prioritize latency as per guidelines for Gemini 3 models.
                thinkingConfig: { thinkingBudget: 0 },
                // FIX: responseMimeType is supported for gemini-3 series models.
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "An engaging and catchy title for the post." },
                        body: { type: Type.STRING, description: "A well-structured body for the post, at least 3 paragraphs long." },
                        hashtags: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "An array of 3-5 relevant hashtags (without the #)."
                        },
                        imagePrompt: { type: Type.STRING, description: "A short, descriptive prompt to generate a relevant background image." }
                    },
                    required: ["title", "body", "hashtags", "imagePrompt"]
                },
            },
        });
        
        // FIX: Access response text via the .text property as per SDK guidelines.
        const jsonText = response.text?.trim() || "";
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating feed post:", error);
        return null;
    }
};

export const generateChatSummary = async (transcript: string): Promise<string> => {
    if (!transcript.trim()) {
        return "The chat is empty. Nothing to summarize.";
    }
    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name to 'gemini-3-flash-preview' for summarization tasks.
            model: "gemini-3-flash-preview",
            contents: `Summarize the key points and takeaways of the following chat conversation. Keep it concise, easy to read, and use bullet points for important items.

            Conversation Transcript:
            ${transcript}`,
            config: {
                // FIX: Setting thinkingBudget to 0 to prioritize latency.
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        // FIX: Access response text via the .text property as per SDK guidelines.
        return response.text?.trim() || "No summary generated.";
    } catch (error) {
        console.error("Error generating chat summary:", error);
        return "Sorry, I couldn't generate a summary for this chat at the moment.";
    }
};


export const generateSummary = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            // FIX: Updated model name to 'gemini-3-flash-preview' for one-line summarization.
            model: "gemini-3-flash-preview",
            contents: `Generate a concise, one-line summary for the following content: "${text}"`,
            config: {
                // FIX: Setting thinkingBudget to 0 to prioritize latency.
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        // FIX: Access response text via the .text property as per SDK guidelines.
        return response.text?.trim() || "Could not generate summary.";
    } catch (error) {
        console.error("Error generating summary:", error);
        return "Could not generate summary.";
    }
}

interface CardContext {
    title: string;
    content: string;
    author: string;
}

export const getAIChatResponseStream = (
    history: Content[],
    context: CardContext | null,
    useSearch: boolean,
    // FIX: The onChunk callback correctly receives text and optional sources from the grounding chunks.
    onChunk: (chunk: { text: string; sources?: any[] }) => void,
    onError: (error: string) => void,
    onComplete: () => void
): { cancel: () => void } => {
    let isCancelled = false;

    const controller = {
        cancel: () => {
            isCancelled = true;
        },
    };

    const runStream = async () => {
        const contents: Content[] = history;

        const systemInstruction = context
            ? `You are Spark AI, a helpful assistant. You are currently helping a user who is viewing a piece of content on the Invox platform.
The content is titled "${context.title}", written by ${context.author}.
The full content is: "${context.content}".
Your conversation should be focused on this content. Answer questions about it, summarize it, help the user brainstorm ideas related to it, etc. Be friendly and slightly humorous. IMPORTANT: Structure your responses clearly. When providing explanations, summaries, or lists, use markdown bullet points (*). You can also use bold formatting by wrapping text in double asterisks (e.g., **this is bold**) to emphasize key points. This will make the information easy to read and understand.`
            : `You are Spark AI, a helpful, friendly, and slightly humorous assistant. You help users explore ideas, understand topics, and navigate the Invox platform. IMPORTANT: Structure your responses clearly. When providing explanations, summaries, or lists, use markdown bullet points (*). You can also use bold formatting by wrapping text in double asterisks (e.g., **this is bold**) to emphasize key points. This will make the information easy to read and understand.`;

        const config: any = {
            systemInstruction: systemInstruction,
            // FIX: Setting thinkingBudget to 0 to prioritize latency for chat interactions.
            thinkingConfig: { thinkingBudget: 0 }
        };

        if (useSearch) {
            config.tools = [{googleSearch: {}}];
        }

        try {
            const responseStream = await ai.models.generateContentStream({
                // FIX: Updated model name to 'gemini-3-flash-preview' for streaming conversational interactions.
                model: 'gemini-3-flash-preview',
                contents: contents,
                config: config,
            });

            for await (const chunk of responseStream) {
                if (isCancelled) {
                    break;
                }
                // FIX: Cast chunk as GenerateContentResponse to follow guidelines and access .text and candidates property safely.
                const c = chunk as GenerateContentResponse;
                const sources = c.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(gc => gc.web).filter(Boolean);
                // FIX: Access stream chunk text directly via the .text property as per SDK guidelines.
                onChunk({ text: c.text || '', sources: sources });
            }
        } catch (error) {
            console.error("Error getting AI chat response:", error);
            if (!isCancelled) {
                onError("Sorry, I encountered an error. Please try again.");
            }
        } finally {
            if (!isCancelled) {
                onComplete();
            }
        }
    };

    runStream();
    return controller;
};
