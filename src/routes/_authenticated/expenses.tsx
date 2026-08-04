import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RecordTable, type Field } from "@/components/record-table";
import { useSnapshot } from "@/lib/queries";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import type { Expense } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — CFO.ai" },
      {
        name: "description",
        content: "Track spending by category and vendor so the expense intelligence agent can flag anomalies.",
      },
      { property: "og:title", content: "Expenses — CFO.ai" },
      { property: "og:description", content: "Categorised spend with anomaly-ready detail." },
    ],
  }),
  component: ExpensesPage,
});

const PAYMENT_METHODS = ["Bank Transfer", "UPI", "Credit Card", "Cash", "Cheque"];

function ExpensesPage() {
  const { data: snapshot, isLoading } = useSnapshot();
  const currency = snapshot?.business?.currency ?? "INR";
  const suppliers = snapshot?.suppliers ?? [];

  const fields: Field[] = [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "amount", label: "Amount", type: "number", required: true },
    { name: "vendor", label: "Vendor", type: "text" },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
    },
    {
      name: "payment_method",
      label: "Payment method",
      type: "select",
      options: PAYMENT_METHODS.map((c) => ({ value: c, label: c })),
    },
    {
      name: "supplier_id",
      label: "Supplier",
      type: "select",
      options: suppliers.map((s) => ({ value: s.id, label: s.name })),
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const total = (snapshot?.expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={`${snapshot?.expenses.length ?? 0} entries · ${formatCurrency(total, currency, true)} total spend.`}
      />
      <RecordTable<Expense & { id: string }>
        table="expenses"
        fields={fields}
        rows={(snapshot?.expenses ?? []) as (Expense & { id: string })[]}
        loading={isLoading}
        defaults={{
          date: todayISO(),
          category: EXPENSE_CATEGORIES[0],
          payment_method: PAYMENT_METHODS[0],
        }}
        searchKeys={["vendor", "category"]}
        addLabel="Add expense"
        emptyTitle="No expenses recorded"
        emptyDescription="Log your costs so the expense intelligence agent can detect anomalies and duplicates."
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "vendor", header: "Vendor", render: (r) => r.vendor ?? "—" },
          { key: "category", header: "Category", render: (r) => r.category },
          { key: "method", header: "Paid via", render: (r) => r.payment_method },
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
