import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "neutral",
  footer,
  onClick,
}: {
  label: string;
  value: string;
  delta?: number | undefined;
  icon: LucideIcon;
  tone?: "neutral" | "positive" | "negative" | "warning" | undefined;
  footer?: ReactNode | undefined;
  onClick?: (() => void) | undefined;
}) {
  const toneClass = {
    neutral: "text-primary bg-primary-soft",
    positive: "text-success bg-success/10",
    negative: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/12",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface group w-full p-5 text-left transition-all duration-300 animate-rise",
        onClick && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-xl", toneClass)}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="num mt-3 text-[26px] font-bold leading-none">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {typeof delta === "number" && Number.isFinite(delta) && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {footer && <span className="text-muted-foreground">{footer}</span>}
      </div>
    </button>
  );
}

export function GlassPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface p-5 animate-rise", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AgentBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
      <span className="size-1.5 rounded-full bg-primary" />
      {name}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
