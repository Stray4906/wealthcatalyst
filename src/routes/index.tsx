import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  FileBarChart,
  LineChart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-cfo.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CFO.ai — Your 24×7 AI Chief Financial Officer for SMBs" },
      {
        name: "description",
        content:
          "Forecast cash flow, catch expense anomalies, predict late invoices and get board-grade financial advice from a multi-agent AI CFO built for small and medium businesses.",
      },
      { property: "og:title", content: "CFO.ai — Your 24×7 AI Chief Financial Officer" },
      {
        property: "og:description",
        content:
          "A multi-agent AI CFO that forecasts cash flow, detects risks and recommends the next financial move.",
      },
    ],
  }),
  component: Landing,
});

const AGENTS = [
  {
    icon: Wallet,
    name: "Cash Flow Agent",
    detail: "Trend + seasonality forecasting with a 3-month confidence band and live runway.",
  },
  {
    icon: AlertTriangle,
    name: "Expense Intelligence Agent",
    detail: "Per-category z-score outliers, duplicate payment detection and spend drift alerts.",
  },
  {
    icon: ReceiptText,
    name: "Invoice Agent",
    detail: "Predicts who will pay late using each customer's own payment history.",
  },
  {
    icon: ShieldCheck,
    name: "Business Health Agent",
    detail: "A weighted 5-factor score with an A–E grade you can track every month.",
  },
  {
    icon: FileBarChart,
    name: "Tax & Compliance Agent",
    detail: "Quarterly GST liability, input credit and the next filing deadline.",
  },
  {
    icon: BrainCircuit,
    name: "Financial Advisor Agent",
    detail: "Turns every signal into ranked, specific actions you can take this week.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen canvas-gradient">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Sparkles className="size-4.5" />
          </span>
          <span className="text-[17px] font-bold tracking-tight">CFO.ai</span>
        </div>
        <Link to="/dashboard">
          <Button variant="outline">Open dashboard</Button>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-24">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> 6 specialist agents, one CFO
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Your 24×7 AI Chief Financial Officer
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              CFO.ai reads your income, expenses, invoices and inventory, then forecasts cash flow,
              flags risks before they hurt, and tells you exactly what to do next — in plain
              language, whenever you ask.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  Open dashboard <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/chat">
                <Button size="lg" variant="outline">
                  Ask the AI CFO
                </Button>
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                { k: "3-month", v: "cash forecast" },
                { k: "A–E", v: "health grade" },
                { k: "24×7", v: "CFO on call" },
              ].map((item) => (
                <div key={item.k}>
                  <dt className="num text-xl font-bold">{item.k}</dt>
                  <dd className="text-xs text-muted-foreground">{item.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-rise">
            <img
              src={heroImage}
              alt="CFO.ai financial intelligence dashboard preview"
              className="w-full rounded-3xl border border-border shadow-[var(--shadow-lift)]"
              loading="eager"
            />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight">A finance team of agents</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Each agent owns one job and shares its findings with the others, so the advice you get
            accounts for your whole financial picture.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent) => (
              <article key={agent.name} className="surface p-5 animate-rise">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <agent.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold">{agent.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {agent.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface mt-14 flex flex-wrap items-center justify-between gap-6 p-8">
          <div className="max-w-lg">
            <LineChart className="size-6 text-primary" />
            <h2 className="mt-3 text-xl font-bold">Know your runway before it becomes a problem</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Load the built-in demo company and explore a fully populated CFO dashboard in seconds.
            </p>
          </div>
          <Link to="/dashboard">
            <Button size="lg" className="gap-2">
              Open dashboard <ArrowRight className="size-4" />
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        CFO.ai — financial intelligence for small and medium businesses.
      </footer>
    </div>
  );
}
