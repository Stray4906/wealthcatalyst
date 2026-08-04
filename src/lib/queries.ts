import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localDb, type Row } from "./local-db";
import type {
  BusinessProfile,
  Customer,
  Expense,
  Income,
  InventoryItem,
  Invoice,
  NotificationRow,
  Snapshot,
  Supplier,
} from "./types";

/** Local (auth-free) data client used for all reads and writes. */
export const db = localDb;

export const snapshotKey = ["cfo-snapshot"];

export async function fetchSnapshot(): Promise<Snapshot> {
  const [incomes, expenses, invoices, customers, suppliers, inventory, business] =
    await Promise.all([
      db.from("incomes").select("*").order("date", { ascending: false }),
      db.from("expenses").select("*").order("date", { ascending: false }),
      db.from("invoices").select("*").order("due_date", { ascending: true }),
      db.from("customers").select("*").order("name"),
      db.from("suppliers").select("*").order("name"),
      db.from("inventory_items").select("*").order("name"),
      db.from("business_profiles").select("*").maybeSingle(),
    ]);

  return {
    incomes: (incomes.data ?? []) as unknown as Income[],
    expenses: (expenses.data ?? []) as unknown as Expense[],
    invoices: (invoices.data ?? []) as unknown as Invoice[],
    customers: (customers.data ?? []) as unknown as Customer[],
    suppliers: (suppliers.data ?? []) as unknown as Supplier[],
    inventory: (inventory.data ?? []) as unknown as InventoryItem[],
    business: (business.data ?? null) as unknown as BusinessProfile | null,
  };
}

export function useSnapshot() {
  return useQuery({ queryKey: snapshotKey, queryFn: fetchSnapshot, staleTime: 15_000 });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as NotificationRow[];
    },
  });
}

type TableName =
  | "incomes"
  | "expenses"
  | "invoices"
  | "customers"
  | "suppliers"
  | "inventory_items"
  | "notifications"
  | "business_profiles";

export function useUpsertRow(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Row) => {
      const { error } = row["id"]
        ? await db.from(table).update(row).eq("id", row["id"])
        : await db.from(table).insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: snapshotKey });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteRow(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: snapshotKey });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
