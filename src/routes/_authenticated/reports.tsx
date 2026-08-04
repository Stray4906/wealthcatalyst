import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell";
import { GlassPanel } from "@/components/kpi";
import { useSnapshot } from "@/lib/queries";
import {
  advisorAgent,
  cashBalance,
  cashFlowAgent,
  expenseAgent,
  healthAgent,
  invoiceAgent,
  monthlySeries,
  taxAgent,
} from "@/lib/agents";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — CFO.ai" },
      {
        name: "description",
        content: "Generate a board-ready profit & loss, cash flow and CFO briefing PDF in one click.",
      },
      { property: "og:title", content: "Reports — CFO.ai" },
      { property: "og:description", content: "Export a full CFO briefing as PDF or CSV." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: snapshot } = useSnapshot();
  const [busy, setBusy] = useState(false);
  const currency = snapshot?.business?.currency ?? "INR";

  const report = useMemo(() => {
    if (!snapshot) return null;
    const series = monthlySeries(snapshot.incomes, snapshot.expenses, 12);
    return {
      series,
      revenue: series.reduce((s, m) => s + m.revenue, 0),
      expenses: series.reduce((s, m) => s + m.expenses, 0),
      health: healthAgent(snapshot),
      cash: cashFlowAgent(snapshot),
      invoices: invoiceAgent(snapshot),
      expense: expenseAgent(snapshot.expenses),
      tax: taxAgent(snapshot),
      recs: advisorAgent(snapshot),
      balance: cashBalance(snapshot),
    };
  }, [snapshot]);

  function exportCsv() {
    if (!report) return;
    const rows = [
      ["Month", "Revenue", "Expenses", "Profit"],
      ...report.series.map((m) => [m.label, m.revenue, m.expenses, m.profit]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cfoai-profit-and-loss.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function exportPdf() {
    if (!report || !snapshot) return;
    setBusy(true);
    try {
      const doc = new jsPDF();
      const name = snapshot.business?.name ?? "Your business";
      doc.setFontSize(18);
      doc.text("CFO.ai — Financial Briefing", 14, 20);
      doc.setFontSize(11);
      doc.text(`${name} · generated ${formatDate(new Date())}`, 14, 28);

      doc.setFontSize(13);
      doc.text("Executive summary", 14, 40);
      doc.setFontSize(10);
      const summary = [
        `Business health score: ${report.health.score}/100 (grade ${report.health.grade})`,
        `Cash position: ${formatCurrency(report.balance, currency)}`,
        `Runway: ${report.cash.runwayMonths === null ? "cash-flow positive" : `${report.cash.runwayMonths} months`}`,
        `Receivables outstanding: ${formatCurrency(report.invoices.outstanding, currency)} (${formatCurrency(report.invoices.overdue, currency)} overdue)`,
        `Estimated GST payable (${report.tax.quarterLabel}): ${formatCurrency(report.tax.gstPayable, currency)}`,
      ];
      summary.forEach((line, i) => doc.text(line, 14, 48 + i * 6));

      autoTable(doc, {
        startY: 84,
        head: [["Month", "Revenue", "Expenses", "Profit"]],
        body: report.series.map((m) => [
          m.label,
          formatCurrency(m.revenue, currency),
          formatCurrency(m.expenses, currency),
          formatCurrency(m.profit, currency),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 94, 74] },
      });

      autoTable(doc, {
        head: [["Agent", "Recommendation", "Impact"]],
        body: report.recs.map((r) => [r.agent, `${r.title} — ${r.action}`, r.impact]),
        styles: { fontSize: 9, cellWidth: "wrap" },
        headStyles: { fillColor: [16, 94, 74] },
      });

      doc.save("cfoai-financial-briefing.pdf");
      toast.success("PDF report generated");
    } finally {
      setBusy(false);
    }
  }

  const profit = (report?.revenue ?? 0) - (report?.expenses ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Board-ready profit & loss, cash flow and agent briefing — exportable in one click."
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!report}>
              <Download className="size-4" /> CSV
            </Button>
            <Button className="gap-2" onClick={exportPdf} disabled={!report || busy}>
              <FileText className="size-4" /> {busy ? "Building…" : "Download PDF"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Revenue (12 mo)", report?.revenue ?? 0],
          ["Expenses (12 mo)", report?.expenses ?? 0],
          ["Net profit", profit],
        ].map(([label, value]) => (
          <div key={label as string} className="surface p-5">
            <p className="text-[13px] text-muted-foreground">{label as string}</p>
            <p className="num mt-2 text-2xl font-bold">
              {formatCurrency(value as number, currency, true)}
            </p>
          </div>
        ))}
      </div>

      <GlassPanel title="Profit & loss by month" subtitle="Rolling 12-month view">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2">Month</th>
                <th className="py-2 text-right">Revenue</th>
                <th className="py-2 text-right">Expenses</th>
                <th className="py-2 text-right">Profit</th>
                <th className="py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(report?.series ?? []).map((m) => (
                <tr key={m.key} className="border-b border-border/50">
                  <td className="py-2">{m.label}</td>
                  <td className="num py-2 text-right">{formatCurrency(m.revenue, currency, true)}</td>
                  <td className="num py-2 text-right">{formatCurrency(m.expenses, currency, true)}</td>
                  <td
                    className={
                      m.profit >= 0
                        ? "num py-2 text-right font-semibold text-success"
                        : "num py-2 text-right font-semibold text-destructive"
                    }
                  >
                    {formatCurrency(m.profit, currency, true)}
                  </td>
                  <td className="num py-2 text-right text-muted-foreground">
                    {m.revenue > 0 ? `${((m.profit / m.revenue) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
