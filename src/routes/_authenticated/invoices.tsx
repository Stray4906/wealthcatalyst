import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { GlassPanel, AgentBadge } from "@/components/kpi";
import { RecordTable, type Field } from "@/components/record-table";
import { useSnapshot } from "@/lib/queries";
import { invoiceAgent } from "@/lib/agents";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices & receivables — CFO.ai" },
      {
        name: "description",
        content: "Track outstanding invoices, aging buckets and AI-predicted payment delays.",
      },
      { property: "og:title", content: "Invoices & receivables — CFO.ai" },
      { property: "og:description", content: "Know who will pay late before they do." },
    ],
  }),
  component: InvoicesPage,
});

const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

function InvoicesPage() {
  const { data: snapshot, isLoading } = useSnapshot();
  const currency = snapshot?.business?.currency ?? "INR";
  const customers = snapshot?.customers ?? [];
  const agent = snapshot ? invoiceAgent(snapshot) : null;

  const fields: Field[] = [
    { name: "invoice_number", label: "Invoice number", type: "text", required: true },
    {
      name: "customer_id",
      label: "Customer",
      type: "select",
      options: customers.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "issue_date", label: "Issue date", type: "date", required: true },
    { name: "due_date", label: "Due date", type: "date", required: true },
    { name: "amount", label: "Amount", type: "number", required: true },
    { name: "tax_amount", label: "Tax amount", type: "number" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: STATUSES.map((s) => ({ value: s, label: s })),
    },
    { name: "paid_date", label: "Paid date", type: "date" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & receivables"
        description={
          agent
            ? `${formatCurrency(agent.outstanding, currency, true)} outstanding · ${formatCurrency(agent.overdue, currency, true)} overdue · avg delay ${agent.averageDelay} days.`
            : "Loading receivables…"
        }
      />

      {agent && agent.risks.length > 0 && (
        <GlassPanel
          title="Aging & payment risk"
          subtitle="Predicted from each customer's own payment history"
          action={<AgentBadge name="Invoice Agent" />}
        >
          <div className="grid gap-3 sm:grid-cols-5">
            {agent.aging.map((bucket) => (
              <div key={bucket.bucket} className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{bucket.bucket}</p>
                <p className="num mt-1 text-base font-bold">
                  {formatCurrency(bucket.amount, currency, true)}
                </p>
                <p className="text-[11px] text-muted-foreground">{bucket.count} invoices</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      <RecordTable<Invoice & { id: string }>
        table="invoices"
        fields={fields}
        rows={(snapshot?.invoices ?? []) as (Invoice & { id: string })[]}
        loading={isLoading}
        defaults={{ issue_date: todayISO(), due_date: todayISO(), status: "sent", tax_amount: 0 }}
        searchKeys={["invoice_number", "status"]}
        addLabel="Add invoice"
        emptyTitle="No invoices yet"
        emptyDescription="Add invoices so the invoice agent can predict late payments and build your aging report."
        columns={[
          { key: "number", header: "Invoice", render: (r) => r.invoice_number },
          {
            key: "customer",
            header: "Customer",
            render: (r) => customers.find((c) => c.id === r.customer_id)?.name ?? "—",
          },
          { key: "due", header: "Due", render: (r) => formatDate(r.due_date) },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge
                variant={
                  r.status === "paid" ? "secondary" : r.status === "overdue" ? "destructive" : "outline"
                }
                className="capitalize"
              >
                {r.status}
              </Badge>
            ),
          },
          {
            key: "risk",
            header: "Risk",
            render: (r) => {
              const risk = agent?.risks.find((x) => x.invoiceId === r.id);
              if (!risk) return <span className="text-muted-foreground">—</span>;
              return (
                <span
                  className={
                    risk.riskLabel === "high"
                      ? "text-destructive font-medium"
                      : risk.riskLabel === "medium"
                        ? "text-warning font-medium"
                        : "text-muted-foreground"
                  }
                >
                  {risk.riskScore}/100 · {risk.predictedDelayDays}d
                </span>
              );
            },
          },
          {
            key: "amount",
            header: "Total",
            className: "text-right num font-semibold",
            render: (r) => formatCurrency(Number(r.amount) + Number(r.tax_amount), currency),
          },
        ]}
      />
    </div>
  );
}
