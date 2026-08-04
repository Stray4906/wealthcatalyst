import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RecordTable, type Field } from "@/components/record-table";
import { useSnapshot } from "@/lib/queries";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { INCOME_CATEGORIES } from "@/lib/types";
import type { Income } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/income")({
  head: () => ({
    meta: [
      { title: "Income — CFO.ai" },
      { name: "description", content: "Record and review every revenue stream feeding your AI CFO." },
      { property: "og:title", content: "Income — CFO.ai" },
      { property: "og:description", content: "Track revenue by source, category and customer." },
    ],
  }),
  component: IncomePage,
});

function IncomePage() {
  const { data: snapshot, isLoading } = useSnapshot();
  const currency = snapshot?.business?.currency ?? "INR";
  const customers = snapshot?.customers ?? [];

  const fields: Field[] = [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "amount", label: "Amount", type: "number", required: true },
    { name: "source", label: "Source", type: "text", placeholder: "Sales, Retainer…" },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: INCOME_CATEGORIES.map((c) => ({ value: c, label: c })),
    },
    {
      name: "customer_id",
      label: "Customer",
      type: "select",
      options: customers.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const total = (snapshot?.incomes ?? []).reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div>
      <PageHeader
        title="Income"
        description={`${snapshot?.incomes.length ?? 0} entries · ${formatCurrency(total, currency, true)} recorded revenue.`}
      />
      <RecordTable<Income & { id: string }>
        table="incomes"
        fields={fields}
        rows={(snapshot?.incomes ?? []) as (Income & { id: string })[]}
        loading={isLoading}
        defaults={{ date: todayISO(), category: INCOME_CATEGORIES[0] }}
        searchKeys={["source", "category"]}
        addLabel="Add income"
        emptyTitle="No income recorded yet"
        emptyDescription="Log your first sale or invoice payment so the cash flow agent can start forecasting."
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "source", header: "Source", render: (r) => r.source || "—" },
          { key: "category", header: "Category", render: (r) => r.category },
          {
            key: "customer",
            header: "Customer",
            render: (r) => customers.find((c) => c.id === r.customer_id)?.name ?? "—",
          },
          {
            key: "amount",
            header: "Amount",
            className: "text-right num font-semibold",
            render: (r) => formatCurrency(Number(r.amount), currency),
          },
        ]}
      />
    </div>
  );
}
