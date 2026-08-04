/**
 * CFO.ai agent engine.
 *
 * Each exported function is one specialist agent. They are pure so they can run
 * in the browser for instant dashboards and on the server to ground the AI CFO.
 */
import { daysBetween, monthKey, monthLabel } from "./format";
import type { Expense, Income, Invoice, Snapshot } from "./types";

export type MonthPoint = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  net: number;
};

export type Forecast = {
  history: { label: string; cash: number }[];
  points: { label: string; cash: number; low: number; high: number }[];
  runwayMonths: number | null;
  averageMonthlyNet: number;
  confidence: number;
};

export type Anomaly = {
  id: string;
  date: string;
  category: string;
  vendor: string;
  amount: number;
  expected: number;
  deviation: number;
  severity: "high" | "medium";
  reason: string;
};

export type DuplicateFlag = {
  id: string;
  vendor: string;
  amount: number;
  dates: string[];
  reason: string;
};

export type PaymentRisk = {
  invoiceId: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  predictedDelayDays: number;
  riskScore: number;
  riskLabel: "high" | "medium" | "low";
};

export type HealthScore = {
  score: number;
  grade: string;
  summary: string;
  components: { key: string; label: string; score: number; weight: number; detail: string }[];
};

export type TaxEstimate = {
  gstCollected: number;
  gstCredit: number;
  gstPayable: number;
  nextFilingDate: string;
  daysToFiling: number;
  quarterLabel: string;
  advanceTaxEstimate: number;
};

export type Recommendation = {
  id: string;
  agent: string;
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  action: string;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const avg = (values: number[]) => (values.length ? sum(values) / values.length : 0);

export function monthlySeries(incomes: Income[], expenses: Expense[], months = 12): MonthPoint[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys.map((key) => {
    const revenue = sum(incomes.filter((i) => monthKey(i.date) === key).map((i) => Number(i.amount)));
    const spend = sum(expenses.filter((e) => monthKey(e.date) === key).map((e) => Number(e.amount)));
    return {
      key,
      label: monthLabel(key),
      revenue,
      expenses: spend,
      profit: revenue - spend,
      net: revenue - spend,
    };
  });
}

export function cashBalance(snapshot: Snapshot): number {
  return (
    sum(snapshot.incomes.map((i) => Number(i.amount))) - sum(snapshot.expenses.map((e) => Number(e.amount)))
  );
}

/** Cash Flow Agent — trend + seasonality forecast (Prophet-style decomposition). */
export function cashFlowAgent(snapshot: Snapshot, horizon = 3): Forecast {
  const series = monthlySeries(snapshot.incomes, snapshot.expenses, 12);
  const nets = series.map((p) => p.net);
  const n = nets.length;

  // Ordinary least squares trend on monthly net cash flow.
  const xs = nets.map((_, i) => i);
  const meanX = avg(xs);
  const meanY = avg(nets);
  const denom = sum(xs.map((x) => (x - meanX) ** 2)) || 1;
  const slope = sum(xs.map((x, i) => (x - meanX) * ((nets[i] ?? 0) - meanY))) / denom;
  const intercept = meanY - slope * meanX;

  const residuals = nets.map((y, i) => y - (intercept + slope * i));
  const volatility = Math.sqrt(avg(residuals.map((r) => r * r)));

  let running = cashBalance(snapshot);
  const history = series.slice(-6).map((p) => ({ label: p.label, cash: 0 }));
  let backfill = running;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const point = history[i];
    if (!point) continue;
    point.cash = Math.round(backfill);
    backfill -= series[series.length - history.length + i]?.net ?? 0;
  }

  const points: Forecast["points"] = [];
  for (let h = 1; h <= horizon; h += 1) {
    const predictedNet = intercept + slope * (n - 1 + h);
    running += predictedNet;
    const band = volatility * Math.sqrt(h) * 1.28;
    const date = new Date();
    date.setMonth(date.getMonth() + h);
    points.push({
      label: monthLabel(monthKey(date)),
      cash: Math.round(running),
      low: Math.round(running - band),
      high: Math.round(running + band),
    });
  }

  const burn = avg(nets.filter((v) => v < 0).map((v) => Math.abs(v)));
  const balance = cashBalance(snapshot);
  const runwayMonths = burn > 0 ? Math.max(0, Math.round((balance / burn) * 10) / 10) : null;
  const spread = Math.abs(meanY) || 1;
  const confidence = Math.max(45, Math.min(95, Math.round(100 - (volatility / spread) * 35)));

  return { history, points, runwayMonths, averageMonthlyNet: Math.round(meanY), confidence };
}

/** Expense Intelligence Agent — per-category z-score outliers (Isolation-Forest style). */
export function expenseAgent(expenses: Expense[]): {
  anomalies: Anomaly[];
  duplicates: DuplicateFlag[];
  byCategory: { category: string; amount: number; share: number }[];
  monthOverMonth: number;
} {
  const byCat = new Map<string, Expense[]>();
  expenses.forEach((e) => {
    const list = byCat.get(e.category) ?? [];
    list.push(e);
    byCat.set(e.category, list);
  });

  const anomalies: Anomaly[] = [];
  byCat.forEach((items, category) => {
    if (items.length < 4) return;
    const amounts = items.map((i) => Number(i.amount));
    const mean = avg(amounts);
    const sd = Math.sqrt(avg(amounts.map((a) => (a - mean) ** 2))) || 1;
    items.forEach((item) => {
      const z = (Number(item.amount) - mean) / sd;
      if (z > 2) {
        anomalies.push({
          id: item.id,
          date: item.date,
          category,
          vendor: item.vendor ?? "Unknown vendor",
          amount: Number(item.amount),
          expected: Math.round(mean),
          deviation: Math.round(z * 100) / 100,
          severity: z > 3 ? "high" : "medium",
          reason: `${Math.round(z * 10) / 10}σ above the usual ${category} spend`,
        });
      }
    });
  });

  const duplicates: DuplicateFlag[] = [];
  const seen = new Map<string, Expense[]>();
  expenses.forEach((e) => {
    const key = `${(e.vendor ?? "").toLowerCase()}|${Number(e.amount).toFixed(2)}`;
    const list = seen.get(key) ?? [];
    list.push(e);
    seen.set(key, list);
  });
  seen.forEach((items, key) => {
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      if (!current || !previous) continue;
      if (Math.abs(daysBetween(current.date, previous.date)) <= 7) {
        duplicates.push({
          id: `${key}-${i}`,
          vendor: current.vendor ?? "Unknown vendor",
          amount: Number(current.amount),
          dates: [previous.date, current.date],
          reason: "Identical amount charged by the same vendor within 7 days",
        });
        break;
      }
    }
  });

  const total = sum(expenses.map((e) => Number(e.amount))) || 1;
  const byCategory = [...byCat.entries()]
    .map(([category, items]) => {
      const amount = sum(items.map((i) => Number(i.amount)));
      return { category, amount, share: (amount / total) * 100 };
    })
    .sort((a, b) => b.amount - a.amount);

  const series = monthlySeries([], expenses, 3);
  const last = series[series.length - 1]?.expenses ?? 0;
  const prev = series[series.length - 2]?.expenses ?? 0;
  const monthOverMonth = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  return { anomalies: anomalies.slice(0, 12), duplicates: duplicates.slice(0, 8), byCategory, monthOverMonth };
}

/** Invoice Agent — payment-delay prediction from customer payment history. */
export function invoiceAgent(snapshot: Snapshot): {
  outstanding: number;
  overdue: number;
  risks: PaymentRisk[];
  aging: { bucket: string; amount: number; count: number }[];
  averageDelay: number;
} {
  const nameOf = (id: string | null) =>
    snapshot.customers.find((c) => c.id === id)?.name ?? "Walk-in customer";

  const paid = snapshot.invoices.filter((i) => i.status === "paid" && i.paid_date);
  const delayByCustomer = new Map<string, number[]>();
  paid.forEach((inv) => {
    const delay = daysBetween(inv.paid_date as string, inv.due_date);
    const key = inv.customer_id ?? "unknown";
    const list = delayByCustomer.get(key) ?? [];
    list.push(delay);
    delayByCustomer.set(key, list);
  });
  const globalDelay = avg(paid.map((i) => daysBetween(i.paid_date as string, i.due_date)));

  const open = snapshot.invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const today = new Date();

  const risks: PaymentRisk[] = open
    .map((inv) => {
      const total = Number(inv.amount) + Number(inv.tax_amount);
      const history = delayByCustomer.get(inv.customer_id ?? "unknown") ?? [];
      // Ensemble: customer history (0.6) + global behaviour (0.25) + invoice size pressure (0.15)
      const sizePressure = Math.min(12, total / 100000);
      const predicted =
        (history.length ? avg(history) : globalDelay) * 0.6 + globalDelay * 0.25 + sizePressure * 0.15;
      const daysOverdue = Math.max(0, daysBetween(today, inv.due_date));
      const riskScore = Math.max(
        0,
        Math.min(100, Math.round(daysOverdue * 1.8 + Math.max(0, predicted) * 2.4 + sizePressure * 2)),
      );
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        customer: nameOf(inv.customer_id),
        amount: total,
        dueDate: inv.due_date,
        daysOverdue,
        predictedDelayDays: Math.max(0, Math.round(predicted)),
        riskScore,
        riskLabel: riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low",
      } satisfies PaymentRisk;
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const buckets = [
    { bucket: "Not due", min: -9999, max: 0 },
    { bucket: "1-30 days", min: 1, max: 30 },
    { bucket: "31-60 days", min: 31, max: 60 },
    { bucket: "61-90 days", min: 61, max: 90 },
    { bucket: "90+ days", min: 91, max: 99999 },
  ];
  const aging = buckets.map((b) => {
    const items = risks.filter((r) => r.daysOverdue >= b.min && r.daysOverdue <= b.max);
    return { bucket: b.bucket, amount: sum(items.map((i) => i.amount)), count: items.length };
  });

  return {
    outstanding: sum(risks.map((r) => r.amount)),
    overdue: sum(risks.filter((r) => r.daysOverdue > 0).map((r) => r.amount)),
    risks,
    aging,
    averageDelay: Math.round(globalDelay),
  };
}

/** Business Health Agent — weighted 5-factor score. */
export function healthAgent(snapshot: Snapshot): HealthScore {
  const series = monthlySeries(snapshot.incomes, snapshot.expenses, 6);
  const revenue = sum(series.map((s) => s.revenue));
  const spend = sum(series.map((s) => s.expenses));
  const profit = revenue - spend;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const invoices = invoiceAgent(snapshot);
  const balance = cashBalance(snapshot);
  const monthlyBurn = spend / Math.max(1, series.length);
  const liquidity = monthlyBurn > 0 ? balance / monthlyBurn : 6;

  const recent = series.slice(-3);
  const older = series.slice(0, 3);
  const growth =
    sum(older.map((s) => s.revenue)) > 0
      ? ((sum(recent.map((s) => s.revenue)) - sum(older.map((s) => s.revenue))) /
          sum(older.map((s) => s.revenue))) *
        100
      : 0;

  const positiveMonths = series.filter((s) => s.net > 0).length;
  const receivablePressure = revenue > 0 ? (invoices.overdue / revenue) * 100 : 0;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const components = [
    {
      key: "profitability",
      label: "Profitability",
      score: clamp(50 + margin * 2),
      weight: 0.25,
      detail: `${margin.toFixed(1)}% net margin over 6 months`,
    },
    {
      key: "liquidity",
      label: "Liquidity",
      score: clamp((liquidity / 6) * 100),
      weight: 0.25,
      detail: `${liquidity.toFixed(1)} months of cash cover`,
    },
    {
      key: "receivables",
      label: "Receivables & debt",
      score: clamp(100 - receivablePressure * 3),
      weight: 0.2,
      detail: `${receivablePressure.toFixed(1)}% of revenue stuck in overdue invoices`,
    },
    {
      key: "growth",
      label: "Growth",
      score: clamp(50 + growth * 1.5),
      weight: 0.15,
      detail: `${growth.toFixed(1)}% revenue change quarter over quarter`,
    },
    {
      key: "cashflow",
      label: "Cash flow stability",
      score: clamp((positiveMonths / Math.max(1, series.length)) * 100),
      weight: 0.15,
      detail: `${positiveMonths} of ${series.length} months cash positive`,
    },
  ];

  const score = Math.round(sum(components.map((c) => c.score * c.weight)));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
  const summary =
    score >= 70
      ? "Financially healthy with room to invest in growth."
      : score >= 55
        ? "Stable but watch liquidity and collections closely."
        : "Under pressure — protect cash and cut discretionary spend now.";

  return { score, grade, summary, components };
}

/** Tax & Compliance Agent — GST liability and filing calendar. */
export function taxAgent(snapshot: Snapshot): TaxEstimate {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);

  const quarterIncome = sum(
    snapshot.incomes.filter((i) => new Date(i.date) >= start).map((i) => Number(i.amount)),
  );
  const quarterExpense = sum(
    snapshot.expenses.filter((e) => new Date(e.date) >= start).map((e) => Number(e.amount)),
  );

  const gstCollected = quarterIncome * 0.18;
  const gstCredit = quarterExpense * 0.18 * 0.65;
  const gstPayable = Math.max(0, gstCollected - gstCredit);

  const filing = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  const profit = Math.max(0, quarterIncome - quarterExpense);

  return {
    gstCollected: Math.round(gstCollected),
    gstCredit: Math.round(gstCredit),
    gstPayable: Math.round(gstPayable),
    nextFilingDate: filing.toISOString().slice(0, 10),
    daysToFiling: daysBetween(filing, now),
    quarterLabel: `Q${Math.floor(quarterStartMonth / 3) + 1} ${now.getFullYear()}`,
    advanceTaxEstimate: Math.round(profit * 0.25),
  };
}

/** Financial Advisor Agent — turns every other agent's signal into next actions. */
export function advisorAgent(snapshot: Snapshot): Recommendation[] {
  const health = healthAgent(snapshot);
  const cash = cashFlowAgent(snapshot);
  const expense = expenseAgent(snapshot.expenses);
  const invoices = invoiceAgent(snapshot);
  const tax = taxAgent(snapshot);
  const recs: Recommendation[] = [];

  if (invoices.overdue > 0) {
    recs.push({
      id: "collect",
      agent: "Invoice Agent",
      title: `Chase ${Math.round(invoices.overdue).toLocaleString("en-IN")} in overdue receivables`,
      detail: `${invoices.risks.filter((r) => r.daysOverdue > 0).length} invoices are past due. Your highest-risk account is ${invoices.risks[0]?.customer ?? "n/a"}.`,
      impact: "high",
      action: "Send reminders to the top 3 late payers today",
    });
  }

  if (expense.monthOverMonth > 10) {
    recs.push({
      id: "spend",
      agent: "Expense Intelligence Agent",
      title: `Spending rose ${expense.monthOverMonth.toFixed(0)}% month over month`,
      detail: `${expense.byCategory[0]?.category ?? "Operating"} is your largest category at ${expense.byCategory[0]?.share.toFixed(0) ?? 0}% of total spend.`,
      impact: "high",
      action: "Review the top category and freeze non-essential renewals",
    });
  }

  if (expense.anomalies.length) {
    recs.push({
      id: "anomaly",
      agent: "Expense Intelligence Agent",
      title: `${expense.anomalies.length} unusual transactions detected`,
      detail: expense.anomalies[0]?.reason ?? "Review flagged transactions.",
      impact: "medium",
      action: "Verify flagged transactions against receipts",
    });
  }

  if (cash.runwayMonths !== null && cash.runwayMonths < 4) {
    recs.push({
      id: "runway",
      agent: "Cash Flow Agent",
      title: `Only ${cash.runwayMonths} months of runway at current burn`,
      detail: "Forecast cash falls below a comfortable buffer within the next quarter.",
      impact: "high",
      action: "Build a 3-month cash preservation plan",
    });
  } else {
    recs.push({
      id: "invest",
      agent: "Cash Flow Agent",
      title: `Projected cash of ${Math.round(cash.points[cash.points.length - 1]?.cash ?? 0).toLocaleString("en-IN")} in 3 months`,
      detail: `Average monthly net cash flow is ${cash.averageMonthlyNet.toLocaleString("en-IN")} with ${cash.confidence}% model confidence.`,
      impact: "medium",
      action: "Allocate surplus to growth or a reserve deposit",
    });
  }

  if (tax.daysToFiling <= 20) {
    recs.push({
      id: "gst",
      agent: "Tax & Compliance Agent",
      title: `GST of ${tax.gstPayable.toLocaleString("en-IN")} due in ${tax.daysToFiling} days`,
      detail: `${tax.quarterLabel} liability after input credit of ${tax.gstCredit.toLocaleString("en-IN")}.`,
      impact: "high",
      action: "Set aside the GST amount before month end",
    });
  }

  const weakest = [...health.components].sort((a, b) => a.score - b.score)[0];
  if (weakest) {
    recs.push({
      id: "health",
      agent: "Business Health Agent",
      title: `${weakest.label} is your weakest health factor (${weakest.score}/100)`,
      detail: weakest.detail,
      impact: weakest.score < 45 ? "high" : "medium",
      action: `Set a 90-day target to lift ${weakest.label.toLowerCase()}`,
    });
  }

  return recs;
}

/** Compact grounding context used by the CFO Chat Agent. */
export function buildAgentBriefing(snapshot: Snapshot) {
  const series = monthlySeries(snapshot.incomes, snapshot.expenses, 12);
  return {
    business: snapshot.business?.name ?? "the business",
    currency: snapshot.business?.currency ?? "INR",
    cashBalance: Math.round(cashBalance(snapshot)),
    monthly: series.map((s) => ({
      month: s.label,
      revenue: Math.round(s.revenue),
      expenses: Math.round(s.expenses),
      profit: Math.round(s.profit),
    })),
    forecast: cashFlowAgent(snapshot),
    health: healthAgent(snapshot),
    expenses: expenseAgent(snapshot.expenses),
    invoices: invoiceAgent(snapshot),
    tax: taxAgent(snapshot),
    recommendations: advisorAgent(snapshot),
    inventoryValue: Math.round(
      sum(snapshot.inventory.map((i) => Number(i.quantity) * Number(i.unit_cost))),
    ),
    customerCount: snapshot.customers.length,
  };
}
