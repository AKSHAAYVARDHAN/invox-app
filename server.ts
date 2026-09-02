import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", server: "invox-fullstack" });
  });

  // Gemini Feed Post Generation
  app.post("/api/gemini/feed-post", async (req, res) => {
    try {
      const { idea } = req.body;
      if (!idea || typeof idea !== "string") {
        return res.status(400).json({ error: "Idea string is required" });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: `Based on the following user idea, generate a full feed post. The idea is: "${idea}".`,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
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

      const jsonText = response.text?.trim() || "{}";
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (error: any) {
      console.error("[SERVER_GEMINI] Error in feed-post:", error);
      res.status(500).json({ error: error.message || "Failed to generate feed post" });
    }
  });

  // Gemini Chat Summarization
  app.post("/api/gemini/chat-summary", async (req, res) => {
    try {
      const { transcript } = req.body;
      if (!transcript || !transcript.trim()) {
        return res.json({ summary: "The chat is empty. Nothing to summarize." });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: `Summarize the key points and takeaways of the following chat conversation. Keep it concise, easy to read, and use bullet points for important items.

Conversation Transcript:
${transcript}`,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      const summary = response.text?.trim() || "No summary generated.";
      res.json({ summary });
    } catch (error: any) {
      console.error("[SERVER_GEMINI] Error in chat-summary:", error);
      res.status(500).json({ error: error.message || "Failed to generate chat summary", summary: "Sorry, I couldn't generate a summary for this chat at the moment." });
    }
  });

  // Gemini One-line Summary
  app.post("/api/gemini/summary", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.json({ summary: "No content to summarize." });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: `Generate a concise, one-line summary for the following content: "${text}"`,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      const summary = response.text?.trim() || "Could not generate summary.";
      res.json({ summary });
    } catch (error: any) {
      console.error("[SERVER_GEMINI] Error in summary:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary", summary: "Could not generate summary." });
    }
  });

  // Gemini Chat Streaming (SSE)
  app.post("/api/gemini/chat-stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const { history, context, useSearch } = req.body;

    try {
      const ai = getGeminiClient();

      const systemInstruction = context
        ? `You are Spark AI, a helpful assistant. You are currently helping a user who is viewing a piece of content on the Invox platform.
The content is titled "${context.title}", written by ${context.author}.
The full content is: "${context.content}".
Your conversation should be focused on this content. Answer questions about it, summarize it, help the user brainstorm ideas related to it, etc. Be friendly and slightly humorous. IMPORTANT: Structure your responses clearly. When providing explanations, summaries, or lists, use markdown bullet points (*). You can also use bold formatting by wrapping text in double asterisks (e.g., **this is bold**) to emphasize key points. This will make the information easy to read and understand.`
        : `You are Spark AI, a helpful, friendly, and slightly humorous assistant. You help users explore ideas, understand topics, and navigate the Invox platform. IMPORTANT: Structure your responses clearly. When providing explanations, summaries, or lists, use markdown bullet points (*). You can also use bold formatting by wrapping text in double asterisks (e.g., **this is bold**) to emphasize key points. This will make the information easy to read and understand.`;

      const config: any = {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 }
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.7-flash",
        contents: history || [],
        config,
      });

      for await (const chunk of responseStream) {
        const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((gc: any) => gc.web)
          .filter(Boolean);
        const text = chunk.text || "";

        const payload = JSON.stringify({ text, sources });
        res.write(`data: ${payload}\n\n`);
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      console.error("[SERVER_GEMINI] Error in chat-stream:", error);
      const errorPayload = JSON.stringify({ error: error.message || "Failed to generate AI response." });
      res.write(`event: error\ndata: ${errorPayload}\n\n`);
      res.end();
    }
  });

  // Vite middleware for development vs static build serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[INVOX_SERVER] Server running on port ${PORT}`);
  });
}

startServer();
