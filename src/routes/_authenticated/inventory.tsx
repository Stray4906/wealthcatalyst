import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";
import { RecordTable, type Field } from "@/components/record-table";
import { useSnapshot } from "@/lib/queries";
import { formatCurrency } from "@/lib/format";
import type { InventoryItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — CFO.ai" },
      {
        name: "description",
        content: "Track stock value, margins and reorder levels so working capital stays healthy.",
      },
      { property: "og:title", content: "Inventory — CFO.ai" },
      { property: "og:description", content: "Stock value and reorder alerts for working capital." },
    ],
  }),
  component: InventoryPage,
});

const fields: Field[] = [
  { name: "name", label: "Item name", type: "text", required: true },
  { name: "sku", label: "SKU", type: "text" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit_cost", label: "Unit cost", type: "number" },
  { name: "unit_price", label: "Unit price", type: "number" },
  { name: "reorder_level", label: "Reorder level", type: "number" },
];

function InventoryPage() {
  const { data: snapshot, isLoading } = useSnapshot();
  const currency = snapshot?.business?.currency ?? "INR";
  const items = (snapshot?.inventory ?? []) as (InventoryItem & { id: string })[];
  const stockValue = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_cost), 0);
  const lowStock = items.filter((i) => Number(i.quantity) <= Number(i.reorder_level)).length;

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`${items.length} items · ${formatCurrency(stockValue, currency, true)} tied up in stock · ${lowStock} below reorder level.`}
      />
      <RecordTable<InventoryItem & { id: string }>
        table="inventory_items"
        fields={fields}
        rows={items}
        loading={isLoading}
        defaults={{ quantity: 0, unit_cost: 0, unit_price: 0, reorder_level: 10 }}
        searchKeys={["name", "sku"]}
        addLabel="Add item"
        emptyTitle="No inventory items"
        emptyDescription="Add stock items to see how much working capital is locked in inventory."
        columns={[
          { key: "name", header: "Item", render: (r) => r.name },
          { key: "sku", header: "SKU", render: (r) => r.sku ?? "—" },
          {
            key: "qty",
            header: "Stock",
            render: (r) =>
              Number(r.quantity) <= Number(r.reorder_level) ? (
                <Badge variant="destructive">{r.quantity} · reorder</Badge>
              ) : (
                <span className="num">{r.quantity}</span>
              ),
          },
          {
            key: "margin",
            header: "Margin",
            render: (r) =>
              Number(r.unit_price) > 0
                ? `${(((Number(r.unit_price) - Number(r.unit_cost)) / Number(r.unit_price)) * 100).toFixed(0)}%`
                : "—",
          },
          {
            key: "value",
            header: "Stock value",
            className: "text-right num font-semibold",
            render: (r) => formatCurrency(Number(r.quantity) * Number(r.unit_cost), currency),
          },
        ]}
      />
    </div>
  );
}
