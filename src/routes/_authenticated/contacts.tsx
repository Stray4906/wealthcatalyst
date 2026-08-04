import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app-shell";
import { RecordTable, type Field } from "@/components/record-table";
import { useSnapshot } from "@/lib/queries";
import type { Customer, Supplier } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Customers & suppliers — CFO.ai" },
      {
        name: "description",
        content: "Manage the customers who owe you and the suppliers you pay, with terms and contact details.",
      },
      { property: "og:title", content: "Customers & suppliers — CFO.ai" },
      { property: "og:description", content: "Your receivables and payables relationships in one place." },
    ],
  }),
  component: ContactsPage,
});

const customerFields: Field[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "company", label: "Company", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "gstin", label: "GSTIN", type: "text" },
  { name: "payment_terms_days", label: "Payment terms (days)", type: "number" },
];

const supplierFields: Field[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "category", label: "Category", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
];

function ContactsPage() {
  const { data: snapshot, isLoading } = useSnapshot();

  return (
    <div>
      <PageHeader
        title="Customers & suppliers"
        description={`${snapshot?.customers.length ?? 0} customers · ${snapshot?.suppliers.length ?? 0} suppliers feeding your receivables and payables analysis.`}
      />
      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="customers" className="mt-5">
          <RecordTable<Customer & { id: string }>
            table="customers"
            fields={customerFields}
            rows={(snapshot?.customers ?? []) as (Customer & { id: string })[]}
            loading={isLoading}
            defaults={{ payment_terms_days: 30 }}
            searchKeys={["name", "company"]}
            addLabel="Add customer"
            emptyTitle="No customers yet"
            emptyDescription="Add customers to unlock per-customer payment delay predictions."
            columns={[
              { key: "name", header: "Name", render: (r) => r.name },
              { key: "company", header: "Company", render: (r) => r.company ?? "—" },
              { key: "email", header: "Email", render: (r) => r.email ?? "—" },
              { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
              {
                key: "terms",
                header: "Terms",
                render: (r) => `${r.payment_terms_days ?? 30} days`,
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-5">
          <RecordTable<Supplier & { id: string }>
            table="suppliers"
            fields={supplierFields}
            rows={(snapshot?.suppliers ?? []) as (Supplier & { id: string })[]}
            loading={isLoading}
            searchKeys={["name", "category"]}
            addLabel="Add supplier"
            emptyTitle="No suppliers yet"
            emptyDescription="Add suppliers to attribute expenses and spot duplicate payments."
            columns={[
              { key: "name", header: "Name", render: (r) => r.name },
              { key: "category", header: "Category", render: (r) => r.category ?? "—" },
              { key: "email", header: "Email", render: (r) => r.email ?? "—" },
              { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
