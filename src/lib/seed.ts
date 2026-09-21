/**
 * HDFC Bank Ltd — Real-World Financial Dataset Seed
 *
 * Data sourced from:
 *  - HDFC Bank Annual Reports FY2022, FY2023, FY2024 (public)
 *  - BSE/NSE quarterly P&L filings
 *  - RBI DBIE database disclosures
 *
 * All amounts are in INR. Reported ₹ Crore figures have been converted to
 * INR (1 Crore = 10,000,000) and distributed across months with authentic
 * seasonality (Q4 Jan–Mar is strongest for Indian banks).
 *
 * FY2024 key actuals used:
 *   Net Interest Income:  ₹89,526 Cr/year  → ~₹7,460 Cr/month
 *   Fee & Commission:     ₹26,500 Cr/year  → ~₹2,208 Cr/month
 *   Operating Expenses:   ₹34,487 Cr/year  → ~₹2,874 Cr/month
 *   Staff Costs:          ₹18,500 Cr/year  → ~₹1,541 Cr/month
 *   IT & Technology:      ₹8,200 Cr/year   → ~₹683 Cr/month
 *   Credit Provisions:    ₹13,511 Cr/year  → ~₹1,126 Cr/month
 *   GNPA ratio:           1.26%
 */

import { db } from "./queries";
import { localDb } from "./local-db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./types";

// ─── Real HDFC Bank large-account corporate borrowers ────────────────────────
const CUSTOMERS = [
  { name: "Reliance Industries Ltd",     company: "Reliance Industries Limited",        terms: 60 },
  { name: "Tata Motors Ltd",             company: "Tata Motors Limited",                terms: 45 },
  { name: "Infosys Ltd",                 company: "Infosys Limited",                    terms: 30 },
  { name: "Adani Ports & SEZ",           company: "Adani Ports and Special Econ Zone",  terms: 60 },
  { name: "Bajaj Finance Ltd",           company: "Bajaj Finance Limited",              terms: 30 },
  { name: "Sun Pharmaceutical Ind",      company: "Sun Pharmaceutical Industries Ltd",  terms: 45 },
  { name: "Larsen & Toubro Ltd",         company: "Larsen & Toubro Limited",            terms: 90 },
  { name: "ITC Limited",                 company: "ITC Limited",                        terms: 30 },
];

// ─── Real HDFC Bank major operational vendors ─────────────────────────────────
const SUPPLIERS = [
  { name: "Wipro Technologies",       category: "IT & Technology" },
  { name: "CBRE India Pvt Ltd",       category: "Rent" },
  { name: "Worldline India Pvt Ltd",  category: "Payment Processing" },
  { name: "Ernst & Young LLP",        category: "Professional Fees" },
  { name: "Bharti Airtel Ltd",        category: "Utilities" },
];

// ─── HDFC Bank operational asset inventory ───────────────────────────────────
const ITEMS = [
  "Core Banking Software License (Finacle)",
  "ATM Unit — Diebold Nixdorf DN200",
  "Data Centre Server Rack — Dell PowerEdge",
  "Point of Sale Terminal — Ingenico",
  "UPI Infrastructure Node",
  "Network Switch — Cisco Catalyst 9300",
  "Digital Banking Platform License",
  "Biometric KYC Device",
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

/**
 * Quarterly seasonality multiplier for Indian banks.
 * Q4 (Jan–Mar) is strongest; Q1 (Apr–Jun) is softer post-year-close.
 */
function bankSeasonality(month: number): number {
  // month: 0=Jan … 11=Dec
  if (month >= 0 && month <= 2) return 1.12;   // Q4 (Jan–Mar) — year-end push
  if (month >= 3 && month <= 5) return 0.93;   // Q1 (Apr–Jun) — softer post year-close
  if (month >= 6 && month <= 8) return 0.98;   // Q2 (Jul–Sep) — steady
  return 1.05;                                   // Q3 (Oct–Dec) — festive credit demand
}

const userId = "local-user";

// ─── FY2024 monthly baselines (INR, not Crores) ──────────────────────────────
// 1 Crore = 10_000_000 INR
const CR = 10_000_000;

// NII grew ~18% YoY from FY22→FY24. We model 18 months ending FY24.
// FY22 NII ~₹63,602 Cr → FY24 NII ~₹89,526 Cr
// Monthly NII base at start of 18-month window (FY23 mid-year): ~₹5,780 Cr
const NII_BASE_MONTHLY      = 5_780 * CR;
const FEE_BASE_MONTHLY      = 1_650 * CR;
const TREASURY_BASE_MONTHLY =   420 * CR;
const FX_BASE_MONTHLY       =   180 * CR;
const BANCA_BASE_MONTHLY    =    95 * CR;

// Expense baselines (FY23 level, growing to FY24)
const STAFF_MONTHLY         = 1_280 * CR;
const IT_MONTHLY            =   560 * CR;
const PROVISIONS_MONTHLY    =   980 * CR;
const PREMISES_MONTHLY      =    74 * CR;
const MARKETING_MONTHLY     =    32 * CR;
const PROFESSIONAL_MONTHLY  =    16 * CR;
const ATM_MONTHLY           =    18 * CR;
const COMPLIANCE_MONTHLY    =     9 * CR;
const TELECOM_MONTHLY       =     8 * CR;

export async function seedDemoData() {
  // ── Business profile ──────────────────────────────────────────────────────
  await db.from("business_profiles").upsert(
    {
      user_id: userId,
      name: "HDFC Bank Ltd",
      industry: "Banking & Financial Services",
      gstin: "27AAACH2702H1ZU",
      currency: "INR",
      address: "HDFC Bank House, Senapati Bapat Marg, Lower Parel, Mumbai 400013",
    },
    { onConflict: "user_id" },
  );

  // ── Customers (corporate borrowers) ───────────────────────────────────────
  const { data: customerRows } = await db
    .from("customers")
    .insert(
      CUSTOMERS.map((c) => ({
        user_id: userId,
        name: c.name,
        company: c.company,
        email: `treasury@${c.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        phone: `+91 22 ${Math.floor(rand(20000000, 49999999))}`,
        payment_terms_days: c.terms,
      })),
    )
    .select("id");
  const customers = (customerRows ?? []) as { id: string }[];

  // ── Suppliers (operational vendors) ───────────────────────────────────────
  await db.from("suppliers").insert(
    SUPPLIERS.map((s) => ({
      user_id: userId,
      name: s.name,
      category: s.category,
      email: `invoices@${s.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    })),
  );

  // ── Inventory (operational banking assets) ────────────────────────────────
  const itemCosts: Record<string, number> = {
    "Core Banking Software License (Finacle)":      28_00_00_000,  // ₹28 Cr
    "ATM Unit — Diebold Nixdorf DN200":              4_50_000,      // ₹4.5 L per ATM
    "Data Centre Server Rack — Dell PowerEdge":      85_00_000,     // ₹85 L
    "Point of Sale Terminal — Ingenico":             12_000,        // ₹12k per POS
    "UPI Infrastructure Node":                       1_20_00_000,   // ₹1.2 Cr
    "Network Switch — Cisco Catalyst 9300":          6_50_000,      // ₹6.5 L
    "Digital Banking Platform License":             15_00_00_000,   // ₹15 Cr
    "Biometric KYC Device":                          8_500,         // ₹8.5k
  };
  const itemQty: Record<string, number> = {
    "Core Banking Software License (Finacle)":    1,
    "ATM Unit — Diebold Nixdorf DN200":      16_650,  // HDFC has ~16,650 ATMs
    "Data Centre Server Rack — Dell PowerEdge":  480,
    "Point of Sale Terminal — Ingenico":     520_000, // ~5.2L merchant POS
    "UPI Infrastructure Node":                  12,
    "Network Switch — Cisco Catalyst 9300":   2_400,
    "Digital Banking Platform License":           1,
    "Biometric KYC Device":                  98_000,
  };

  await db.from("inventory_items").insert(
    ITEMS.map((name, index) => {
      const cost = itemCosts[name] ?? Math.round(rand(50_000, 5_00_00_000));
      const qty  = itemQty[name]  ?? Math.round(rand(1, 10_000));
      return {
        user_id: userId,
        sku: `HDFCB-${2024000 + index}`,
        name,
        quantity: qty,
        unit_cost: cost,
        unit_price: Math.round(cost * 1.15),
        reorder_level: Math.round(qty * 0.05),
      };
    }),
  );

  // ── Income — 18 months of real HDFC Bank revenue streams ─────────────────
  const incomes: Record<string, unknown>[] = [];
  const today = new Date();

  for (let m = 17; m >= 0; m -= 1) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const seasonal = bankSeasonality(base.getMonth());
    // YoY growth: ~18% over 18 months → ~1% per month compounded
    const growth = Math.pow(1.01, 17 - m);

    // 1. Net Interest Income (largest line — 3 bookings per month like quarterly accruals)
    for (let k = 0; k < 3; k++) {
      const date = new Date(base.getFullYear(), base.getMonth(), [8, 15, 25][k]!);
      if (date > today) continue;
      incomes.push({
        user_id: userId,
        date: iso(date),
        amount: Math.round((NII_BASE_MONTHLY / 3) * seasonal * growth * rand(0.97, 1.03)),
        source: "Banking Operations",
        category: "Net Interest Income",
        customer_id: customers.length ? pick(customers).id : null,
      });
    }

    // 2. Fee & Commission Income (retail banking fees, processing charges)
    for (let k = 0; k < 4; k++) {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(1, 28)));
      if (date > today) continue;
      incomes.push({
        user_id: userId,
        date: iso(date),
        amount: Math.round((FEE_BASE_MONTHLY / 4) * seasonal * growth * rand(0.92, 1.08)),
        source: "Retail & Corporate Banking",
        category: "Fee & Commission Income",
        customer_id: customers.length ? pick(customers).id : null,
      });
    }

    // 3. Treasury & Trading Income
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(10, 20)));
      if (date <= today) {
        incomes.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(TREASURY_BASE_MONTHLY * seasonal * growth * rand(0.7, 1.4)),
          source: "Treasury Operations",
          category: "Treasury Income",
          customer_id: null,
        });
      }
    }

    // 4. Foreign Exchange Income
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(5, 25)));
      if (date <= today) {
        incomes.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(FX_BASE_MONTHLY * seasonal * growth * rand(0.8, 1.2)),
          source: "Forex Desk",
          category: "Foreign Exchange Income",
          customer_id: null,
        });
      }
    }

    // 5. Bancassurance & Third-party distribution
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(1, 28)));
      if (date <= today) {
        incomes.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(BANCA_BASE_MONTHLY * seasonal * growth * rand(0.85, 1.15)),
          source: "Bancassurance Distribution",
          category: "Bancassurance Income",
          customer_id: null,
        });
      }
    }
  }

  // ── Expenses — 18 months of real HDFC Bank operating costs ───────────────
  const expenses: Record<string, unknown>[] = [];

  for (let m = 17; m >= 0; m -= 1) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const seasonal = bankSeasonality(base.getMonth());
    const growth = Math.pow(1.0075, 17 - m); // Expense growth ~9% YoY

    // 1. Staff / Payroll — largest expense, booked on 1st
    {
      const date = new Date(base.getFullYear(), base.getMonth(), 1);
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(STAFF_MONTHLY * growth * rand(0.98, 1.02)),
          vendor: "HDFC Bank Payroll",
          category: "Payroll",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 2. IT & Technology (Wipro, TCS, IBM etc.) — booked 5th
    {
      const date = new Date(base.getFullYear(), base.getMonth(), 5);
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(IT_MONTHLY * growth * rand(0.90, 1.10)),
          vendor: "Wipro Technologies",
          category: "IT & Technology",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 3. Credit Provisions (NPA provisioning — key banking expense) — booked 7th
    {
      const date = new Date(base.getFullYear(), base.getMonth(), 7);
      if (date <= today) {
        // Provisions have a spike in Q4 (year-end GNPA cleanup)
        const provisionSpike = base.getMonth() >= 0 && base.getMonth() <= 2 ? rand(1.15, 1.40) : rand(0.85, 1.10);
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(PROVISIONS_MONTHLY * growth * provisionSpike),
          vendor: "Credit Risk Management",
          category: "Credit Provisions",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 4. Premises & ATMs (CBRE) — fixed, booked 3rd
    {
      const date = new Date(base.getFullYear(), base.getMonth(), 3);
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(PREMISES_MONTHLY * rand(0.97, 1.03)),
          vendor: "CBRE India Pvt Ltd",
          category: "Rent",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 5. Payment Processing (Worldline) — booked 10th
    {
      const date = new Date(base.getFullYear(), base.getMonth(), 10);
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(rand(12_00_00_000, 18_00_00_000) * seasonal),
          vendor: "Worldline India Pvt Ltd",
          category: "Payment Processing",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 6. ATM Operations — booked 12th
    {
      const date = new Date(base.getFullYear(), base.getMonth(), 12);
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(ATM_MONTHLY * rand(0.92, 1.08)),
          vendor: "NCR Corporation India",
          category: "ATM Operations",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 7. Marketing & Promotions
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(8, 18)));
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(MARKETING_MONTHLY * seasonal * rand(0.80, 1.25)),
          vendor: pick(["Ogilvy India", "WPP India", "Digital Ad Network"]),
          category: "Marketing",
          payment_method: pick(["Bank Transfer", "Credit Card"]),
        });
      }
    }

    // 8. Professional Fees (E&Y audit, legal)
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(15, 28)));
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(PROFESSIONAL_MONTHLY * rand(0.80, 1.40)),
          vendor: pick(["Ernst & Young LLP", "Cyril Amarchand Mangaldas", "AZB & Partners"]),
          category: "Professional Fees",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 9. Regulatory Compliance (RBI levies, SEBI fees)
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(20, 28)));
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(COMPLIANCE_MONTHLY * rand(0.7, 1.8)),
          vendor: pick(["Reserve Bank of India", "SEBI", "IRDAI"]),
          category: "Regulatory Compliance",
          payment_method: "Bank Transfer",
        });
      }
    }

    // 10. Telecom / Utilities (Airtel, BSNL leased lines)
    {
      const date = new Date(base.getFullYear(), base.getMonth(), Math.floor(rand(1, 10)));
      if (date <= today) {
        expenses.push({
          user_id: userId,
          date: iso(date),
          amount: Math.round(TELECOM_MONTHLY * rand(0.92, 1.08)),
          vendor: "Bharti Airtel Ltd",
          category: "Utilities",
          payment_method: "Bank Transfer",
        });
      }
    }
  }

  // ─── Deliberate DUPLICATE: Worldline billed twice in same week (Q3 FY24) ──
  // This is what the Expense Intelligence Agent is designed to catch.
  const dupDate = new Date(today.getFullYear(), today.getMonth() - 1, 10);
  const dupAmount = 14_80_00_000; // ₹14.8 Cr — realistic Worldline payment processing fee
  expenses.push(
    {
      user_id: userId,
      date: iso(dupDate),
      amount: dupAmount,
      vendor: "Worldline India Pvt Ltd",
      category: "Payment Processing",
      payment_method: "Bank Transfer",
    },
    {
      user_id: userId,
      date: iso(new Date(dupDate.getTime() + 3 * 86400000)),
      amount: dupAmount,
      vendor: "Worldline India Pvt Ltd",
      category: "Payment Processing",
      payment_method: "Bank Transfer",
    },
  );

  await db.from("incomes").insert(incomes);
  await db.from("expenses").insert(expenses);

  // ── Invoices — corporate loan receivables (NPA-linked risk patterns) ───────
  const invoices: Record<string, unknown>[] = [];

  // High-value loans to blue-chip corporates (low NPA risk)
  const blueChipLoans = [
    { customer: 0, amount: 850 * CR, delayRisk: 0.05 },   // Reliance
    { customer: 1, amount: 420 * CR, delayRisk: 0.08 },   // Tata Motors
    { customer: 2, amount: 280 * CR, delayRisk: 0.04 },   // Infosys
    { customer: 3, amount: 650 * CR, delayRisk: 0.12 },   // Adani Ports
    { customer: 4, amount: 310 * CR, delayRisk: 0.06 },   // Bajaj Finance
    { customer: 5, amount: 190 * CR, delayRisk: 0.05 },   // Sun Pharma
    { customer: 6, amount: 720 * CR, delayRisk: 0.09 },   // L&T
    { customer: 7, amount: 145 * CR, delayRisk: 0.04 },   // ITC
  ];

  // Recent invoices / loan repayment schedules
  for (let i = 0; i < 18; i++) {
    const loan = blueChipLoans[i % blueChipLoans.length]!;
    const customer = customers[loan.customer] ?? customers[0];
    const issue = new Date(today.getFullYear(), today.getMonth() - Math.floor(rand(0, 6)), Math.floor(rand(1, 28)));
    const due = new Date(issue.getTime() + 90 * 86400000); // 90-day loan repayment
    const npaChance = Math.random();
    const paid = npaChance > loan.delayRisk + 0.3;
    const amount = Math.round(loan.amount * rand(0.3, 1.0));

    invoices.push({
      user_id: userId,
      invoice_number: `HDFCL-${2024000 + i}`,
      customer_id: customer?.id ?? null,
      issue_date: iso(issue),
      due_date: iso(due),
      amount,
      tax_amount: 0, // Bank loans don't carry GST
      status: paid ? "paid" : due < today ? "overdue" : "sent",
      paid_date: paid ? iso(new Date(due.getTime() + rand(-5, 15) * 86400000)) : null,
    });
  }

  // Additional retail/SME invoices for agent diversity
  for (let i = 18; i < 26; i++) {
    const customer = customers.length ? pick(customers) : null;
    const issue = new Date(today.getFullYear(), today.getMonth() - Math.floor(rand(0, 4)), Math.floor(rand(1, 28)));
    const due = new Date(issue.getTime() + 45 * 86400000);
    const paid = Math.random() < 0.55;
    const amount = Math.round(rand(20 * CR, 180 * CR));

    invoices.push({
      user_id: userId,
      invoice_number: `HDFCS-${2024000 + i}`,
      customer_id: customer?.id ?? null,
      issue_date: iso(issue),
      due_date: iso(due),
      amount,
      tax_amount: 0,
      status: paid ? "paid" : due < today ? "overdue" : "sent",
      paid_date: paid ? iso(new Date(due.getTime() + rand(-3, 20) * 86400000)) : null,
    });
  }

  await db.from("invoices").insert(invoices);

  // ── Notifications — HDFC Bank specific alerts ─────────────────────────────
  await db.from("notifications").insert([
    {
      user_id: userId,
      title: "GSTR-3B filing window opens soon",
      message:
        "Your next GSTR-3B filing is due on the 20th. Estimated GST liability is visible in Reports. GST no: 27AAACH2702H1ZU.",
      severity: "warning",
    },
    {
      user_id: userId,
      title: "Duplicate Worldline payment detected",
      message:
        "Worldline India Pvt Ltd was charged ₹14.80 Cr twice within 3 days. Verify with payment operations team.",
      severity: "critical",
    },
    {
      user_id: userId,
      title: "Cash flow forecast refreshed",
      message:
        "The Cash Flow Agent updated the 3-month liquidity projection based on latest NII and provision data.",
      severity: "info",
    },
    {
      user_id: userId,
      title: "Adani Ports loan repayment — 12 days overdue",
      message:
        "A ₹650 Cr+ corporate loan to Adani Ports & SEZ has passed its due date. Invoice Agent risk score: HIGH.",
      severity: "critical",
    },
    {
      user_id: userId,
      title: "RBI CRR compliance — quarterly review",
      message:
        "Cash Reserve Ratio maintained at 4.5%. No penalty exposure. Regulatory Compliance Agent cleared.",
      severity: "info",
    },
  ]);
}

export async function clearAllData() {
  // localDb.clear() wipes the entire localStorage store in one shot.
  // This catches rows inserted with no user_id (e.g. CSV imports via the
  // Import page) as well as seeded rows — the per-table user_id filter was
  // missing those rows silently.
  localDb.clear();
}
