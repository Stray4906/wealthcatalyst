import { createFileRoute } from "@tanstack/react-router";
import { buildAgentBriefing } from "@/lib/agents";
import type { Snapshot } from "@/lib/types";

type ChatBody = {
  messages?: { role: "user" | "assistant"; content: string }[];
  snapshot?: Snapshot;
};

const SYSTEM = `You are CFO.ai — a 24x7 AI Chief Financial Officer for small and medium businesses.

You orchestrate a team of specialist agents whose latest analysis is provided to you as JSON:
- Cash Flow Agent (liquidity forecast, runway)
- Expense Intelligence Agent (category mix, anomalies, duplicates)
- Invoice Agent (receivables, aging, payment-delay prediction)
- Business Health Agent (5-factor score)
- Tax & Compliance Agent (GST liability, filing dates)
- Financial Advisor Agent (recommendations)

Rules:
- Ground every number in the supplied JSON. Never invent figures.
- Answer like a sharp CFO: lead with the direct answer, then 2-4 supporting bullets, then one recommended action.
- Use Indian Rupee formatting (₹) unless the currency field says otherwise.
- Name the agent(s) whose data you used.
- Keep answers under 220 words. Use markdown.
- If data is missing, say so plainly and suggest what to record.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const geminiKey = process.env["GEMINI_API_KEY"] || (import.meta as any).env?.GEMINI_API_KEY;
        const openrouterKey = process.env["OPENROUTER_API_KEY"] || (import.meta as any).env?.OPENROUTER_API_KEY;
        const openaiKey = process.env["OPENAI_API_KEY"] || (import.meta as any).env?.OPENAI_API_KEY;
        const lovableKey = process.env["LOVABLE_API_KEY"] || (import.meta as any).env?.LOVABLE_API_KEY;

        if (!openrouterKey && !openaiKey && !geminiKey && !lovableKey) {
          return new Response(
            `AI is not configured. (Available env keys: ${Object.keys(process.env).filter(k => k.includes("API") || k.includes("KEY")).join(", ") || "none"})`,
            { status: 500 }
          );
        }

        const body = (await request.json()) as ChatBody;
        const messages = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
        if (!messages.length) return new Response("messages required", { status: 400 });

        const briefing = body.snapshot
          ? buildAgentBriefing(body.snapshot)
          : { note: "No financial data recorded yet." };

        const fullMessages = [
          { role: "system", content: SYSTEM },
          {
            role: "system",
            content: `LIVE AGENT BRIEFING (JSON):\n${JSON.stringify(briefing)}`,
          },
          ...messages,
        ];

        if (geminiKey) {
          const geminiModel = process.env["AI_MODEL"] || "gemini-3.5-flash-lite";
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiKey}`;

          // Format contents for Gemini API:
          // System prompt as systemInstruction, and user/assistant messages as contents
          const contents = messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

          const geminiPayload = {
            systemInstruction: {
              parts: [
                { text: SYSTEM },
                { text: `LIVE AGENT BRIEFING (JSON):\n${JSON.stringify(briefing)}` },
              ],
            },
            contents,
          };

          const upstream = await fetch(geminiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(geminiPayload),
          });

          if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text();
            console.error(`Gemini API error [${upstream.status}] at ${geminiUrl.replace(geminiKey, "REDACTED")}: ${detail}`);
            return new Response(`AI service error (${upstream.status}): ${detail}`, { status: upstream.status });
          }

          // Transform Gemini SSE stream into OpenAI-compatible delta format expected by the frontend
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          const stream = new ReadableStream({
            async start(controller) {
              let buffer = "";
              try {
                for (;;) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() ?? "";

                  for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                      const parsed = JSON.parse(jsonStr);
                      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (text) {
                        const openAiChunk = `data: ${JSON.stringify({
                          choices: [{ delta: { content: text } }],
                        })}\n\n`;
                        controller.enqueue(encoder.encode(openAiChunk));
                      }
                    } catch {
                      // ignore json parse error for partial lines
                    }
                  }
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              } catch (err) {
                controller.error(err);
              } finally {
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }

        let endpoint = "https://openrouter.ai/api/v1/chat/completions";
        let headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        let model = "google/gemma-4-31b-it:free";

        if (openrouterKey) {
          endpoint = "https://openrouter.ai/api/v1/chat/completions";
          headers["Authorization"] = `Bearer ${openrouterKey}`;
          headers["HTTP-Referer"] = "https://cfo.ai";
          headers["X-Title"] = "CFO.ai";
          model = process.env["AI_MODEL"] || "google/gemma-4-31b-it:free";
        } else if (openaiKey) {
          endpoint = "https://api.openai.com/v1/chat/completions";
          headers["Authorization"] = `Bearer ${openaiKey}`;
          model = process.env["AI_MODEL"] || "gpt-4o-mini";
        } else if (lovableKey) {
          endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
          headers["Lovable-API-Key"] = lovableKey;
          headers["X-Lovable-AIG-SDK"] = "fetch";
          model = process.env["AI_MODEL"] || "google/gemini-2.5-flash";
        }

        const upstream = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            stream: true,
            messages: fullMessages,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text();
          console.error(`AI gateway error [${upstream.status}]: ${detail}`);
          const message =
            upstream.status === 429
              ? "Too many requests right now. Please try again in a moment."
              : upstream.status === 402
                ? "AI credits are exhausted. Add credits to continue."
                : "The AI CFO could not respond right now.";
          return new Response(message, { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
