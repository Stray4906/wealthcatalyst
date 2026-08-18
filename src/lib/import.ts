/**
 * Import engine for external accounting data.
 * Handles CSV/TSV exports (Tally, Zoho Books, Winman, QuickBooks, Excel-saved CSV)
 * and Tally XML day books. Everything runs client side and lands in the local store.
 */

import { db } from "./queries";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./types";

export type TargetTable =
  | "incomes"
  | "expenses"
  | "invoices"
  | "customers"
  | "suppliers"
  | "inventory_items";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
};

export type FieldSpec = {
  name: string;
  label: string;
  required?: boolean;
  kind: "text" | "number" | "date";
  aliases: string[];
};

export const SOURCES = [
  { id: "auto", label: "Auto-detect", hint: "Works with most exports" },
  { id: "tally", label: "Tally (CSV / XML)", hint: "Day book, ledger vouchers" },
  { id: "zoho", label: "Zoho Books", hint: "Invoices, expenses, contacts" },
  { id: "winman", label: "Winman", hint: "Books & GST exports" },
  { id: "quickbooks", label: "QuickBooks / Xero", hint: "Transaction reports" },
  { id: "csv", label: "Generic CSV", hint: "Any spreadsheet export" },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export const TARGETS: { id: TargetTable; label: string; fields: FieldSpec[] }[] = [
  {
    id: "incomes",
    label: "Income / Sales",
    fields: [
      { name: "date", label: "Date", required: true, kind: "date", aliases: ["date", "voucher date", "txn date", "transaction date", "invoice date", "posting date"] },
      { name: "amount", label: "Amount", required: true, kind: "number", aliases: ["amount", "credit", "total", "value", "gross amount", "debit amount", "amount (inr)", "grand total"] },
      { name: "source", label: "Source / Party", kind: "text", aliases: ["particulars", "party", "party name", "customer name", "ledger", "ledger name", "source", "description", "narration", "account"] },
      { name: "category", label: "Category", kind: "text", aliases: ["category", "voucher type", "type", "item", "class"] },
      { name: "notes", label: "Notes", kind: "text", aliases: ["narration", "notes", "remarks", "memo", "reference"] },
    ],
  },
  {
    id: "expenses",
    label: "Expenses / Purchases",
    fields: [
      { name: "date", label: "Date", required: true, kind: "date", aliases: ["date", "voucher date", "txn date", "transaction date", "bill date", "expense date"] },
      { name: "amount", label: "Amount", required: true, kind: "number", aliases: ["amount", "debit", "total", "value", "gross amount", "amount (inr)", "grand total"] },
      { name: "vendor", label: "Vendor", kind: "text", aliases: ["particulars", "party", "party name", "vendor", "vendor name", "supplier", "ledger", "ledger name", "account", "paid to"] },
      { name: "category", label: "Category", kind: "text", aliases: ["category", "expense account", "voucher type", "type", "head", "class"] },
      { name: "payment_method", label: "Payment method", kind: "text", aliases: ["payment method", "mode", "paid through", "payment mode", "bank"] },
      { name: "notes", label: "Notes", kind: "text", aliases: ["narration", "notes", "remarks", "memo", "reference"] },
    ],
  },
  {
    id: "invoices",
    label: "Invoices / Receivables",
    fields: [
      { name: "invoice_number", label: "Invoice no.", required: true, kind: "text", aliases: ["invoice number", "invoice no", "invoice#", "voucher no", "bill no", "document number", "reference"] },
      { name: "issue_date", label: "Issue date", required: true, kind: "date", aliases: ["invoice date", "issue date", "date", "voucher date"] },
      { name: "due_date", label: "Due date", kind: "date", aliases: ["due date", "expected payment date", "maturity date"] },
      { name: "amount", label: "Amount", required: true, kind: "number", aliases: ["amount", "total", "invoice amount", "grand total", "balance", "value"] },
      { name: "tax_amount", label: "Tax", kind: "number", aliases: ["tax", "tax amount", "gst", "gst amount", "cgst", "vat"] },
      { name: "status", label: "Status", kind: "text", aliases: ["status", "invoice status", "payment status"] },
      { name: "paid_date", label: "Paid date", kind: "date", aliases: ["paid date", "payment date", "settled on"] },
      { name: "customer_name", label: "Customer name", kind: "text", aliases: ["customer name", "party name", "customer", "party", "billed to", "ledger name"] },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    fields: [
      { name: "name", label: "Name", required: true, kind: "text", aliases: ["name", "customer name", "party name", "ledger name", "display name", "company name"] },
      { name: "email", label: "Email", kind: "text", aliases: ["email", "email address", "e-mail"] },
      { name: "phone", label: "Phone", kind: "text", aliases: ["phone", "mobile", "contact", "phone number"] },
      { name: "company", label: "Company", kind: "text", aliases: ["company", "company name", "organisation", "organization"] },
      { name: "gstin", label: "GSTIN", kind: "text", aliases: ["gstin", "gst no", "gst number", "tax id", "gst identification number"] },
      { name: "payment_terms_days", label: "Payment terms (days)", kind: "number", aliases: ["payment terms", "credit days", "terms", "credit period"] },
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    fields: [
      { name: "name", label: "Name", required: true, kind: "text", aliases: ["name", "supplier name", "vendor name", "party name", "ledger name", "display name"] },
      { name: "email", label: "Email", kind: "text", aliases: ["email", "email address"] },
      { name: "phone", label: "Phone", kind: "text", aliases: ["phone", "mobile", "contact"] },
      { name: "category", label: "Category", kind: "text", aliases: ["category", "group", "type", "expense head"] },
    ],
  },
  {
    id: "inventory_items",
    label: "Inventory",
    fields: [
      { name: "name", label: "Item name", required: true, kind: "text", aliases: ["name", "item name", "stock item", "product", "description"] },
      { name: "sku", label: "SKU", kind: "text", aliases: ["sku", "item code", "code", "part number", "hsn"] },
      { name: "quantity", label: "Quantity", kind: "number", aliases: ["quantity", "qty", "closing balance", "stock", "closing qty"] },
      { name: "unit_cost", label: "Unit cost", kind: "number", aliases: ["unit cost", "cost", "purchase rate", "rate", "cost price"] },
      { name: "unit_price", label: "Unit price", kind: "number", aliases: ["unit price", "selling price", "sale rate", "price", "mrp"] },
      { name: "reorder_level", label: "Reorder level", kind: "number", aliases: ["reorder level", "minimum stock", "reorder point", "min qty"] },
    ],
  },
];

/* ---------------------------------- parsing --------------------------------- */

function detectDelimiter(line: string): string {
  const counts = [",", ";", "\t", "|"].map((d) => [d, line.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 1 ? counts[0]![0] : ",";
}

/** Minimal RFC-4180 CSV reader with quote support. */
function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function parseCsv(text: string, fileName: string): ParsedFile {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [], fileName };
  const delimiter = detectDelimiter(lines[0]!);
  let grid = splitRows(clean, delimiter);

  // Skip preamble/title lines some exports add before the real header row.
  const widest = Math.max(...grid.map((r) => r.length));
  const headerIndex = grid.findIndex(
    (r) => r.filter((c) => c.trim() !== "").length >= Math.min(2, widest),
  );
  if (headerIndex > 0) grid = grid.slice(headerIndex);

  const rawHeaders = (grid[0] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`);
  const headers = rawHeaders.map((h, i) =>
    rawHeaders.indexOf(h) === i ? h : `${h} (${i + 1})`,
  );
  const rows = grid.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
  return { headers, rows: rows.filter((r) => Object.values(r).some((v) => v !== "")), fileName };
}

/** Flattens a Tally XML export (day book / ledger voucher dump) into rows. */
export function parseTallyXml(text: string, fileName: string): ParsedFile {
  const vouchers = text.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/gi) ?? [];
  const tag = (chunk: string, name: string) => {
    const match = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    return match ? match[1]!.replace(/<[^>]+>/g, "").trim() : "";
  };
  const toIso = (raw: string) =>
    /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;

  const rows = vouchers.map((v) => {
    const amounts = [...v.matchAll(/<AMOUNT>([^<]*)<\/AMOUNT>/gi)].map((m) =>
      Math.abs(Number(m[1]!.replace(/[^0-9.-]/g, ""))),
    );
    return {
      Date: toIso(tag(v, "DATE")),
      "Voucher No": tag(v, "VOUCHERNUMBER"),
      "Voucher Type": tag(v, "VOUCHERTYPENAME"),
      "Party Name": tag(v, "PARTYLEDGERNAME") || tag(v, "PARTYNAME"),
      Narration: tag(v, "NARRATION"),
      Amount: String(Math.max(0, ...amounts.filter((n) => Number.isFinite(n)))),
    };
  });

  const headers = ["Date", "Voucher No", "Voucher Type", "Party Name", "Narration", "Amount"];
  return { headers, rows: rows.filter((r) => r.Date || r.Amount !== "0"), fileName };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const isXml = /\.xml$/i.test(file.name) || text.trimStart().startsWith("<");
  return isXml ? parseTallyXml(text, file.name) : parseCsv(text, file.name);
}

/* --------------------------------- mapping --------------------------------- */

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function autoMap(headers: string[], target: TargetTable): Record<string, string> {
  const spec = TARGETS.find((t) => t.id === target)!;
  const map: Record<string, string> = {};
  const used = new Set<string>();

  for (const field of spec.fields) {
    const match =
      headers.find((h) => !used.has(h) && field.aliases.includes(norm(h))) ??
      headers.find((h) => !used.has(h) && field.aliases.some((a) => norm(h).includes(a)));
    if (match) {
      map[field.name] = match;
      used.add(match);
    }
  }
  return map;
}

/** Guesses the best destination table from the header row. */
export function detectTarget(headers: string[]): TargetTable {
  const scores = TARGETS.map((t) => {
    const map = autoMap(headers, t.id);
    const required = t.fields.filter((f) => f.required);
    const hasRequired = required.every((f) => map[f.name]);
    return { id: t.id, score: Object.keys(map).length + (hasRequired ? 3 : 0) };
  });
  scores.sort((a, b) => b.score - a.score);
  const hay = headers.map(norm).join(" ");
  if (/(credit|sales|receipt)/.test(hay) && !/(debit|purchase|expense)/.test(hay)) return "incomes";
  return scores[0]!.id;
}

/* -------------------------------- conversion -------------------------------- */

export function toNumber(raw: string): number {
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw.trim()) || raw.includes("-");
  const digits = raw.replace(/[^0-9.]/g, "");
  const value = Number(digits);
  if (!Number.isFinite(value)) return 0;
  return negative ? -value : value;
}

export function toDate(raw: string): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

  const dmy = value.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})$/);
  if (dmy) {
    const [, a, b, y] = dmy;
    const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);
    // Day-first (Indian exports) unless the first part can only be a month.
    const day = Number(a) > 12 ? Number(a) : Number(b) > 12 ? Number(b) : Number(a);
    const month = Number(a) > 12 ? Number(b) : Number(b) > 12 ? Number(a) : Number(b);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function closestCategory(raw: string, list: string[], fallback: string): string {
  const value = norm(raw);
  if (!value) return fallback;
  return list.find((c) => norm(c) === value) ?? list.find((c) => value.includes(norm(c))) ?? fallback;
}

export type BuildResult = {
  valid: Record<string, unknown>[];
  skipped: number;
  issues: string[];
};

export function buildRows(
  parsed: ParsedFile,
  target: TargetTable,
  mapping: Record<string, string>,
): BuildResult {
  const spec = TARGETS.find((t) => t.id === target)!;
  const valid: Record<string, unknown>[] = [];
  const issues: string[] = [];
  let skipped = 0;

  parsed.rows.forEach((source, index) => {
    const row: Record<string, unknown> = {};
    let bad = "";

    for (const field of spec.fields) {
      const column = mapping[field.name];
      const raw = column ? (source[column] ?? "") : "";
      if (field.kind === "number") {
        const n = Math.abs(toNumber(raw));
        if (field.required && !n) bad ||= `${field.label} missing`;
        row[field.name] = n;
      } else if (field.kind === "date") {
        const d = toDate(raw);
        if (field.required && !d) bad ||= `${field.label} unreadable`;
        row[field.name] = d;
      } else {
        if (field.required && !raw) bad ||= `${field.label} missing`;
        row[field.name] = raw || null;
      }
    }

    if (bad) {
      skipped += 1;
      if (issues.length < 5) issues.push(`Row ${index + 2}: ${bad}`);
      return;
    }

    if (target === "incomes") {
      row["category"] = closestCategory(String(row["category"] ?? ""), INCOME_CATEGORIES, "Other Income");
      row["source"] = row["source"] ?? "Imported";
      row["customer_id"] = null;
    }
    if (target === "expenses") {
      row["category"] = closestCategory(String(row["category"] ?? ""), EXPENSE_CATEGORIES, "Miscellaneous");
      row["payment_method"] = (row["payment_method"] as string) || "Bank Transfer";
      row["supplier_id"] = null;
    }
    if (target === "invoices") {
      const issue = row["issue_date"] as string;
      if (!row["due_date"]) {
        const due = new Date(issue);
        due.setDate(due.getDate() + 30);
        row["due_date"] = due.toISOString().slice(0, 10);
      }
      const status = String(row["status"] ?? "").toLowerCase();
      row["status"] = status.includes("paid")
        ? "paid"
        : status.includes("cancel")
          ? "cancelled"
          : status.includes("part")
            ? "partial"
            : "unpaid";
      row["tax_amount"] = Number(row["tax_amount"] ?? 0);
      if (row["status"] !== "paid") row["paid_date"] = null;
    }
    if (target === "customers") {
      row["payment_terms_days"] = Number(row["payment_terms_days"] ?? 0) || 30;
    }
    if (target === "inventory_items") {
      row["quantity"] = Number(row["quantity"] ?? 0);
      row["unit_cost"] = Number(row["unit_cost"] ?? 0);
      row["unit_price"] = Number(row["unit_price"] ?? 0);
      row["reorder_level"] = Number(row["reorder_level"] ?? 0);
    }

    valid.push(row);
  });

  return { valid, skipped, issues };
}

/** Links invoices to customers by name, creating missing customers on the fly. */
async function resolveCustomers(rows: Record<string, unknown>[]) {
  const { data } = await db.from("customers").select("*");
  const existing = (data ?? []) as { id: string; name: string }[];
  const byName = new Map(existing.map((c) => [norm(c.name), c.id]));

  for (const row of rows) {
    const name = String(row["customer_name"] ?? "").trim();
    delete row["customer_name"];
    if (!name) {
      row["customer_id"] = null;
      continue;
    }
    let id = byName.get(norm(name));
    if (!id) {
      const created = await db
        .from("customers")
        .insert({ name, email: null, phone: null, company: name, gstin: null, payment_terms_days: 30 });
      const inserted = (created.data as { id: string }[] | null)?.[0];
      id = inserted?.id;
      if (id) byName.set(norm(name), id);
    }
    row["customer_id"] = id ?? null;
  }
}

export async function commitRows(target: TargetTable, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;
  const payload = rows.map((r) => ({ ...r }));
  if (target === "invoices") await resolveCustomers(payload);
  await db.from(target).insert(payload);
  return payload.length;
}
