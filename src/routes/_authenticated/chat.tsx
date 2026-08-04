import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app-shell";
import { useSnapshot } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Ask your AI CFO — CFO.ai" },
      {
        name: "description",
        content:
          "Chat with an AI CFO grounded in your live cash flow, expense, invoice and tax data.",
      },
      { property: "og:title", content: "Ask your AI CFO — CFO.ai" },
      {
        property: "og:description",
        content: "Conversational financial analysis grounded in your own books.",
      },
    ],
  }),
  component: ChatPage,
});

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "cfoai.conversation.v1";

const PROMPTS = [
  "How is my cash flow looking for the next 3 months?",
  "Where am I overspending this month?",
  "Which customers are likely to pay late?",
  "What should I fix first to improve my health score?",
];

function ChatPage() {
  const { data: snapshot } = useSnapshot();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setMessages(JSON.parse(saved) as Message[]);
      } catch {
        /* ignore corrupt history */
      }
    }
    setHydrated(true);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, hydrated]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, snapshot }),
      });
      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              answer += delta;
              setMessages([...next, { role: "assistant", content: answer }]);
            }
          } catch {
            /* partial chunk */
          }
        }
      }

      if (!answer) {
        setMessages([
          ...next,
          { role: "assistant", content: "I couldn't produce an answer. Please try again." },
        ]);
      }
    } catch (error) {
      setMessages(next);
      toast.error(error instanceof Error ? error.message : "The AI CFO is unavailable right now.");
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Ask your AI CFO"
        description="Grounded in your live books — every answer cites the agents behind it."
        action={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setMessages([]);
              window.localStorage.removeItem(STORAGE_KEY);
              inputRef.current?.focus();
            }}
          >
            <RotateCcw className="size-4" /> New conversation
          </Button>
        }
      />

      <div ref={scrollRef} className="surface flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Your CFO is on duty</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ask anything about cash, spend, receivables, tax or growth.
              </p>
            </div>
            <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  className="rounded-xl border border-border bg-card p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
          >
            {message.role === "assistant" && (
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {message.role === "assistant" ? (
                message.content ? (
                  <div className="prose-cfo">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </span>
                )
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about runway, margins, overdue invoices, GST…"
          className="min-h-[52px] flex-1 resize-none"
        />
        <Button type="submit" size="lg" className="gap-2" disabled={streaming || !input.trim()}>
          <Send className="size-4" /> Send
        </Button>
      </form>
    </div>
  );
}
