export type Income = {
  id: string;
  date: string;
  amount: number;
  source: string;
  category: string;
  customer_id: string | null;
  notes: string | null;
};

export type Expense = {
  id: string;
  date: string;
  amount: number;
  vendor: string | null;
  category: string;
  payment_method: string;
  supplier_id: string | null;
  notes: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  tax_amount: number;
  status: string;
  paid_date: string | null;
};

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  gstin: string | null;
  payment_terms_days: number;
};

export type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
};

export type InventoryItem = {
  id: string;
  sku: string | null;
  name: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  reorder_level: number;
};

export type BusinessProfile = {
  id: string;
  name: string;
  industry: string | null;
  gstin: string | null;
  currency: string;
  fiscal_year_start: number;
  address: string | null;
};

export type NotificationRow = {
  id: string;
  title: string;
  message: string | null;
  severity: string;
  read: boolean;
  created_at: string;
};

export type Snapshot = {
  incomes: Income[];
  expenses: Expense[];
  invoices: Invoice[];
  customers: Customer[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  business: BusinessProfile | null;
};

export const EXPENSE_CATEGORIES = [
  // Generic
  "Payroll",
  "Rent",
  "Marketing",
  "Software",
  "Utilities",
  "Travel",
  "Raw Materials",
  "Professional Fees",
  "Logistics",
  "Miscellaneous",
  // Banking / HDFC Bank specific
  "IT & Technology",
  "Credit Provisions",
  "ATM Operations",
  "Regulatory Compliance",
  "Payment Processing",
];

export const INCOME_CATEGORIES = [
  // Generic
  "Product Sales",
  "Service Revenue",
  "Subscriptions",
  "Consulting",
  "Interest Income",
  "Other Income",
  // Banking / HDFC Bank specific
  "Net Interest Income",
  "Fee & Commission Income",
  "Treasury Income",
  "Foreign Exchange Income",
  "Bancassurance Income",
];
