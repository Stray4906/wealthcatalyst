export function formatCurrency(value: number, currency = "INR", compact = false): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function formatPercent(value: number, digits = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe > 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function monthKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const first = typeof a === "string" ? new Date(a) : a;
  const second = typeof b === "string" ? new Date(b) : b;
  return Math.round((first.getTime() - second.getTime()) / 86_400_000);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
