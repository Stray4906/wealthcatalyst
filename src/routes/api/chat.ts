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
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const body = (await request.json()) as ChatBody;
        const messages = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
        if (!messages.length) return new Response("messages required", { status: 400 });

        const briefing = body.snapshot
          ? buildAgentBriefing(body.snapshot)
          : { note: "No financial data recorded yet." };

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            stream: true,
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "system",
                content: `LIVE AGENT BRIEFING (JSON):\n${JSON.stringify(briefing)}`,
              },
              ...messages,
            ],
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
