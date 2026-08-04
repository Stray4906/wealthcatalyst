import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Untyped view of the client for generic table writes. */
export const db = supabase as unknown as SupabaseClient;
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

export const snapshotKey = ["cfo-snapshot"];

export async function fetchSnapshot(): Promise<Snapshot> {
  const [incomes, expenses, invoices, customers, suppliers, inventory, business] = await Promise.all([
    supabase.from("incomes").select("*").order("date", { ascending: false }),
    supabase.from("expenses").select("*").order("date", { ascending: false }),
    supabase.from("invoices").select("*").order("due_date", { ascending: true }),
    supabase.from("customers").select("*").order("name"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("inventory_items").select("*").order("name"),
    supabase.from("business_profiles").select("*").maybeSingle(),
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
      const { data } = await supabase
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
    mutationFn: async (row: Record<string, unknown>) => {
      const { data: session } = await supabase.auth.getUser();
      const payload = { ...row, user_id: session.user?.id };
      const query = db.from(table);
      const { error } = row["id"]
        ? await query.update(row).eq("id", row["id"] as string)
        : await query.insert(payload);
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
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: snapshotKey });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
