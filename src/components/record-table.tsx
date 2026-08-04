import { useState, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/kpi";
import { useDeleteRow, useUpsertRow } from "@/lib/queries";

export type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
};

export type Row = Record<string, unknown> & { id: string };

type TableName =
  | "incomes"
  | "expenses"
  | "invoices"
  | "customers"
  | "suppliers"
  | "inventory_items";

export function RecordTable<T extends Row>({
  table,
  fields,
  rows,
  loading,
  columns,
  searchKeys,
  emptyTitle,
  emptyDescription,
  addLabel,
  defaults,
  toolbar,
}: {
  table: TableName;
  fields: Field[];
  rows: T[];
  loading?: boolean;
  columns: { key: string; header: string; render: (row: T) => ReactNode; className?: string }[];
  searchKeys: (keyof T)[];
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  defaults?: Record<string, unknown>;
  toolbar?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const upsert = useUpsertRow(table);
  const remove = useDeleteRow(table);

  const filtered = rows.filter((row) =>
    query
      ? searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(query.toLowerCase()))
      : true,
  );

  function startCreate() {
    const base: Record<string, unknown> = { ...defaults };
    fields.forEach((f) => {
      if (base[f.name] === undefined) base[f.name] = f.type === "number" ? 0 : "";
    });
    setDraft(base);
    setOpen(true);
  }

  function startEdit(row: T) {
    const base: Record<string, unknown> = { id: row.id };
    fields.forEach((f) => {
      base[f.name] = row[f.name] ?? (f.type === "number" ? 0 : "");
    });
    setDraft(base);
    setOpen(true);
  }

  async function save() {
    const missing = fields.find((f) => f.required && !String(draft[f.name] ?? "").trim());
    if (missing) {
      toast.error(`${missing.label} is required`);
      return;
    }
    const payload: Record<string, unknown> = { ...draft };
    fields.forEach((f) => {
      if (f.type === "number") payload[f.name] = Number(payload[f.name] ?? 0);
      if (payload[f.name] === "") payload[f.name] = null;
    });
    try {
      await upsert.mutateAsync(payload);
      toast.success(draft["id"] ? "Record updated" : "Record added");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save record");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records"
            className="pl-9"
          />
        </div>
        {toolbar}
        <Button onClick={startCreate} className="gap-2">
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>

      {loading ? (
        <div className="surface space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button onClick={startCreate} className="gap-2">
              <Plus className="size-4" /> {addLabel}
            </Button>
          }
        />
      ) : (
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.className}>
                      {c.header}
                    </TableHead>
                  ))}
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-accent/40">
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>
                        {c.render(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(row)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await remove.mutateAsync(row.id);
                            toast.success("Record deleted");
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft["id"] ? "Edit record" : addLabel}</DialogTitle>
            <DialogDescription>
              Every entry instantly refreshes your dashboard and AI agent insights.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.name}
                className={field.type === "textarea" ? "sm:col-span-2" : undefined}
              >
                <Label className="mb-1.5 block text-xs font-medium">{field.label}</Label>
                {field.type === "select" ? (
                  <Select
                    value={String(draft[field.name] ?? "")}
                    onValueChange={(value) => setDraft((d) => ({ ...d, [field.name]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    value={String(draft[field.name] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.name]: e.target.value }))}
                  />
                ) : (
                  <Input
                    type={field.type}
                    value={String(draft[field.name] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
