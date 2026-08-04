import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Database,
  Gauge,
  Lightbulb,
  ReceiptText,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app-shell";
import { AgentBadge, GlassPanel, KpiCard } from "@/components/kpi";
import { useSnapshot } from "@/lib/queries";
import { seedDemoData } from "@/lib/seed";
import {
  advisorAgent,
  cashFlowAgent,
  cashBalance,
  expenseAgent,
  healthAgent,
  invoiceAgent,
  monthlySeries,
  taxAgent,
} from "@/lib/agents";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Financial Dashboard — CFO.ai" },
      {
        name: "description",
        content:
          "Live cash flow forecast, business health score, expense anomalies and invoice risk for your business.",
      },
      { property: "og:title", content: "Financial Dashboard — CFO.ai" },
      {
        property: "og:description",
        content: "Your AI CFO's live view of cash, risk and recommended actions.",
      },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function Dashboard() {
  const { data: snapshot, isLoading, refetch } = useSnapshot();
  const [seeding, setSeeding] = useState(false);

  const analysis = useMemo(() => {
    if (!snapshot) return null;
    return {
      series: monthlySeries(snapshot.incomes, snapshot.expenses, 12),
      cash: cashFlowAgent(snapshot),
      expense: expenseAgent(snapshot.expenses),
      invoices: invoiceAgent(snapshot),
      health: healthAgent(snapshot),
      tax: taxAgent(snapshot),
      recs: advisorAgent(snapshot),
      balance: cashBalance(snapshot),
    };
  }, [snapshot]);

  const currency = snapshot?.business?.currency ?? "INR";
  const empty = !!snapshot && snapshot.incomes.length === 0 && snapshot.expenses.length === 0;

  async function loadDemo() {
    setSeeding(true);
    try {
      await seedDemoData();
      await refetch();
      toast.success("Demo company loaded — 18 months of financial history");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load demo data");
    } finally {
      setSeeding(false);
    }
  }

  if (isLoading || !analysis) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const { series, cash, expense, invoices, health, tax, recs, balance } = analysis;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const revenueDelta =
    prev && prev.revenue > 0 ? (((last?.revenue ?? 0) - prev.revenue) / prev.revenue) * 100 : undefined;

  const forecastData = [
    ...cash.history.map((h) => ({ label: h.label, actual: h.cash })),
    ...cash.points.map((p) => ({
      label: p.label,
      forecast: p.cash,
      band: [p.low, p.high] as [number, number],
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${snapshot?.business?.name ?? "Your business"} · Financial command centre`}
        description="Six specialist agents analysed your books just now. Here's where you stand."
        action={
          <Button variant="outline" className="gap-2" onClick={loadDemo} disabled={seeding}>
            <Database className="size-4" /> {seeding ? "Loading…" : "Load demo company"}
          </Button>
        }
      />

      {empty && (
        <div className="surface flex flex-wrap items-center justify-between gap-4 border-primary/30 bg-primary-soft/40 p-5">
          <div>
            <p className="text-sm font-semibold">No financial data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add income and expenses, or load a realistic 18-month demo company to explore every
              agent.
            </p>
          </div>
          <Button onClick={loadDemo} disabled={seeding} className="gap-2">
            <Database className="size-4" /> Load demo company
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Cash position"
          value={formatCurrency(balance, currency, true)}
          icon={Banknote}
          tone={balance >= 0 ? "positive" : "negative"}
          footer={
            cash.runwayMonths === null
              ? "Cash-flow positive"
              : `${cash.runwayMonths} months runway`
          }
        />
        <KpiCard
          label="Revenue this month"
          value={formatCurrency(last?.revenue ?? 0, currency, true)}
          delta={revenueDelta}
          icon={TrendingUp}
          tone="positive"
          footer="vs last month"
        />
        <KpiCard
          label="Expenses this month"
          value={formatCurrency(last?.expenses ?? 0, currency, true)}
          delta={expense.monthOverMonth}
          icon={TrendingDown}
          tone={expense.monthOverMonth > 10 ? "warning" : "neutral"}
          footer="spend drift"
        />
        <KpiCard
          label="Receivables outstanding"
          value={formatCurrency(invoices.outstanding, currency, true)}
          icon={ReceiptText}
          tone={invoices.overdue > 0 ? "warning" : "neutral"}
          footer={`${formatCurrency(invoices.overdue, currency, true)} overdue`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <GlassPanel
          title="Cash flow forecast"
          subtitle={`Next 3 months · ${cash.confidence}% model confidence · avg net ${formatCurrency(cash.averageMonthlyNet, currency, true)}/mo`}
          action={<AgentBadge name="Cash Flow Agent" />}
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v, currency, true)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={70}
                />
                <RTooltip
                  formatter={(value: number | number[]) =>
                    Array.isArray(value)
                      ? `${formatCurrency(value[0] ?? 0, currency, true)} – ${formatCurrency(value[1] ?? 0, currency, true)}`
                      : formatCurrency(value, currency)
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                    fontSize: 12,
                  }}
                />
                <Area
                  dataKey="band"
                  stroke="none"
                  fill="var(--color-chart-2)"
                  fillOpacity={0.15}
                  name="Confidence band"
                />
                <Area
                  dataKey="actual"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  fill="url(#cashFill)"
                  name="Actual cash"
                />
                <Line
                  dataKey="forecast"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  name="Forecast"
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Business health score"
          subtitle={health.summary}
          action={<AgentBadge name="Health Agent" />}
        >
          <div className="flex items-center gap-5">
            <div className="relative grid size-28 shrink-0 place-items-center">
              <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-muted)" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(health.score / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute text-center">
                <p className="num text-2xl font-bold leading-none">{health.score}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">Grade {health.grade}</p>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {health.components.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium">{c.label}</span>
                    <span className="num text-muted-foreground">{c.score}</span>
                  </div>
                  <Progress value={c.score} className="mt-1 h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <GlassPanel title="Revenue vs expenses" subtitle="Last 12 months with profit trend">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v, currency, true)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={70}
                />
                <RTooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Where the money goes"
          subtitle="Expense mix this period"
          action={<AgentBadge name="Expense Agent" />}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expense.byCategory.slice(0, 6)}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {expense.byCategory.slice(0, 6).map((entry, index) => (
                    <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassPanel
          title="Expense anomalies"
          subtitle="Statistical outliers and duplicate payments"
          action={<AgentBadge name="Expense Agent" />}
        >
          {expense.anomalies.length === 0 && expense.duplicates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No unusual spending detected. Your categories are behaving normally.
            </p>
          ) : (
            <ul className="space-y-3">
              {expense.anomalies.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                  <AlertTriangle
                    className={
                      a.severity === "high" ? "mt-0.5 size-4 text-destructive" : "mt-0.5 size-4 text-warning"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {a.vendor} · {a.category}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
                  </div>
                  <span className="num text-sm font-semibold">
                    {formatCurrency(a.amount, currency, true)}
                  </span>
                </li>
              ))}
              {expense.duplicates.slice(0, 2).map((d) => (
                <li key={d.id} className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                  <Activity className="mt-0.5 size-4 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Possible duplicate · {d.vendor}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.reason}</p>
                  </div>
                  <span className="num text-sm font-semibold">
                    {formatCurrency(d.amount, currency, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel
          title="Invoices most likely to be paid late"
          subtitle={`Average customer delay: ${invoices.averageDelay} days`}
          action={<AgentBadge name="Invoice Agent" />}
        >
          {invoices.risks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing outstanding. Every invoice is settled.
            </p>
          ) : (
            <ul className="space-y-3">
              {invoices.risks.slice(0, 5).map((r) => (
                <li key={r.invoiceId} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.invoiceNumber} · {r.customer}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Due {formatDate(r.dueDate)} · predicted {r.predictedDelayDays}d delay
                      {r.daysOverdue > 0 ? ` · ${r.daysOverdue}d overdue` : ""}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold">
                    {formatCurrency(r.amount, currency, true)}
                  </span>
                  <Badge
                    variant={r.riskLabel === "high" ? "destructive" : "secondary"}
                    className="capitalize"
                  >
                    {r.riskLabel}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <GlassPanel
          title="What your CFO recommends"
          subtitle="Ranked by financial impact"
          action={<AgentBadge name="Advisor Agent" />}
        >
          <ul className="space-y-3">
            {recs.map((rec) => (
              <li key={rec.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Lightbulb className="size-4 text-primary" />
                  <p className="flex-1 text-sm font-semibold">{rec.title}</p>
                  <Badge variant={rec.impact === "high" ? "destructive" : "secondary"}>
                    {rec.impact} impact
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{rec.detail}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" /> {rec.action}
                </p>
              </li>
            ))}
            {recs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Add some financial data and your advisor agent will start making recommendations.
              </p>
            )}
          </ul>
        </GlassPanel>

        <GlassPanel
          title="Tax & compliance"
          subtitle={`${tax.quarterLabel} estimate`}
          action={<AgentBadge name="Tax Agent" />}
        >
          <dl className="space-y-3 text-sm">
            {[
              ["GST collected", formatCurrency(tax.gstCollected, currency, true)],
              ["Input tax credit", formatCurrency(tax.gstCredit, currency, true)],
              ["Net GST payable", formatCurrency(tax.gstPayable, currency, true)],
              ["Advance tax estimate", formatCurrency(tax.advanceTaxEstimate, currency, true)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="num font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary-soft p-3">
            <Gauge className="size-5 text-primary" />
            <p className="text-xs">
              Next filing due <strong>{formatDate(tax.nextFilingDate)}</strong> · in{" "}
              {Math.abs(tax.daysToFiling)} days
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
