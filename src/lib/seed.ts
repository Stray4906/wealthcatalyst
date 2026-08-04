import { db } from "./queries";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./types";

const CUSTOMERS = [
  { name: "Aarav Textiles", company: "Aarav Textiles Pvt Ltd", terms: 30 },
  { name: "Nimbus Retail", company: "Nimbus Retail LLP", terms: 45 },
  { name: "Corev Logistics", company: "Corev Logistics", terms: 15 },
  { name: "Bluepeak Foods", company: "Bluepeak Foods Pvt Ltd", terms: 30 },
  { name: "Sundara Interiors", company: "Sundara Interiors", terms: 60 },
  { name: "Vertex Labs", company: "Vertex Labs India", terms: 30 },
  { name: "Halcyon Media", company: "Halcyon Media", terms: 21 },
  { name: "Meridian Traders", company: "Meridian Traders", terms: 30 },
];

const SUPPLIERS = [
  { name: "Rasa Packaging", category: "Raw Materials" },
  { name: "Skyline Realty", category: "Rent" },
  { name: "CloudStack Systems", category: "Software" },
  { name: "Prime Freight", category: "Logistics" },
  { name: "Kapoor & Associates", category: "Professional Fees" },
];

const ITEMS = [
  "Premium Cotton Roll",
  "Industrial Adhesive 5L",
  "Steel Fastener Pack",
  "Packaging Carton L",
  "Label Printer Ribbon",
  "Safety Gloves (Box)",
  "Dispatch Tape Roll",
  "Finished Unit A2",
  "Finished Unit B4",
  "Spare Motor Kit",
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}
function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Seeds 18 months of realistic operating data so every agent has signal. */
export async function seedDemoData(userId: string) {
  await db.from("business_profiles").upsert(
    {
      user_id: userId,
      name: "Northwind Manufacturing",
      industry: "Manufacturing & Distribution",
      gstin: "29ABCDE1234F1Z5",
      currency: "INR",
      address: "Plot 42, Industrial Area, Bengaluru 560058",
    },
    { onConflict: "user_id" },
  );

  const { data: customerRows } = await db
    .from("customers")
    .insert(
      CUSTOMERS.map((c) => ({
        user_id: userId,
        name: c.name,
        company: c.company,
        email: `${c.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        phone: `+91 9${Math.floor(rand(100000000, 999999999))}`,
        payment_terms_days: c.terms,
      })),
    )
    .select("id");
  const customers = (customerRows ?? []) as { id: string }[];

  await db.from("suppliers").insert(
    SUPPLIERS.map((s) => ({
      user_id: userId,
      name: s.name,
      category: s.category,
      email: `accounts@${s.name.toLowerCase().replace(/\s+|&/g, "")}.com`,
    })),
  );

  await db.from("inventory_items").insert(
    ITEMS.map((name, index) => {
      const cost = Math.round(rand(180, 4200));
      return {
        user_id: userId,
        sku: `NW-${1000 + index}`,
        name,
        quantity: Math.round(rand(2, 320)),
        unit_cost: cost,
        unit_price: Math.round(cost * rand(1.25, 1.8)),
        reorder_level: Math.round(rand(15, 60)),
      };
    }),
  );

  const incomes: Record<string, unknown>[] = [];
  const expenses: Record<string, unknown>[] = [];
  const today = new Date();

  for (let m = 17; m >= 0; m -= 1) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const seasonal = 1 + Math.sin((base.getMonth() / 12) * Math.PI * 2) * 0.12;
    const growth = 1 + (17 - m) * 0.018;

    for (let k = 0; k < 8; k += 1) {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(1, 28)));
      if (date > today) continue;
      incomes.push({
        user_id: userId,
        date: iso(date),
        amount: Math.round(rand(45000, 220000) * seasonal * growth),
        source: pick(["Sales", "Retainer", "Marketplace", "Direct"]),
        category: pick(INCOME_CATEGORIES),
        customer_id: customers.length ? pick(customers).id : null,
      });
    }

    const fixed = [
      { category: "Payroll", vendor: "Payroll Run", amount: Math.round(420000 * growth) },
      { category: "Rent", vendor: "Skyline Realty", amount: 145000 },
      { category: "Software", vendor: "CloudStack Systems", amount: Math.round(rand(28000, 42000)) },
    ];
    fixed.forEach((f, i) => {
      expenses.push({
        user_id: userId,
        date: iso(new Date(base.getFullYear(), base.getMonth(), 3 + i)),
        amount: f.amount,
        vendor: f.vendor,
        category: f.category,
        payment_method: "Bank Transfer",
      });
    });

    for (let k = 0; k < 7; k += 1) {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(1, 28)));
      if (date > today) continue;
      const spike = m < 3 && Math.random() < 0.18 ? rand(3.5, 5.5) : 1;
      expenses.push({
        user_id: userId,
        date: iso(date),
        amount: Math.round(rand(9000, 90000) * seasonal * spike),
        vendor: pick(SUPPLIERS).name,
        category: pick(EXPENSE_CATEGORIES),
        payment_method: pick(["Bank Transfer", "Credit Card", "UPI", "Cash"]),
      });
    }
  }

  // Duplicate transaction the Expense Intelligence Agent should catch.
  const dupDate = new Date(today.getFullYear(), today.getMonth(), Math.max(2, today.getDate() - 4));
  expenses.push(
    {
      user_id: userId,
      date: iso(dupDate),
      amount: 64500,
      vendor: "Prime Freight",
      category: "Logistics",
      payment_method: "Bank Transfer",
    },
    {
      user_id: userId,
      date: iso(new Date(dupDate.getTime() + 2 * 86400000)),
      amount: 64500,
      vendor: "Prime Freight",
      category: "Logistics",
      payment_method: "Bank Transfer",
    },
  );

  await db.from("incomes").insert(incomes);
  await db.from("expenses").insert(expenses);

  const invoices: Record<string, unknown>[] = [];
  for (let i = 0; i < 26; i += 1) {
    const issue = new Date(today.getFullYear(), today.getMonth() - Math.floor(rand(0, 5)), Math.floor(rand(1, 28)));
    const customer = customers.length ? pick(customers) : null;
    const due = new Date(issue.getTime() + 30 * 86400000);
    const paid = Math.random() < 0.6;
    const amount = Math.round(rand(40000, 380000));
    invoices.push({
      user_id: userId,
      invoice_number: `INV-${2400 + i}`,
      customer_id: customer?.id ?? null,
      issue_date: iso(issue),
      due_date: iso(due),
      amount,
      tax_amount: Math.round(amount * 0.18),
      status: paid ? "paid" : due < today ? "overdue" : "sent",
      paid_date: paid ? iso(new Date(due.getTime() + rand(-6, 22) * 86400000)) : null,
    });
  }
  await db.from("invoices").insert(invoices);

  await db.from("notifications").insert([
    {
      user_id: userId,
      title: "GST filing window opens soon",
      message: "Your next GSTR-3B filing is due on the 20th. Estimated liability is ready in Reports.",
      severity: "warning",
    },
    {
      user_id: userId,
      title: "Duplicate payment detected",
      message: "Prime Freight was paid the same amount twice within 2 days.",
      severity: "critical",
    },
    {
      user_id: userId,
      title: "Cash flow forecast refreshed",
      message: "The Cash Flow Agent updated your 3-month liquidity projection.",
      severity: "info",
    },
  ]);
}

export async function clearAllData(userId: string) {
  const tables = [
    "incomes",
    "expenses",
    "invoices",
    "inventory_items",
    "notifications",
    "customers",
    "suppliers",
  ] as const;
  for (const table of tables) {
    await db.from(table).delete().eq("user_id", userId);
  }
}
