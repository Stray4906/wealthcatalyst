import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Boxes,
  Building2,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Moon,
  ReceiptText,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { useNotifications } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "AI CFO Chat", icon: Sparkles },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/expenses", label: "Expenses", icon: TrendingDown },
  { to: "/invoices", label: "Invoices", icon: ReceiptText },
  { to: "/contacts", label: "Customers & Suppliers", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Business Profile", icon: Building2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <div className="min-h-screen canvas-gradient">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="size-4.5" />
            </span>
            <span className="text-[17px] font-bold tracking-tight">CFO.ai</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("size-4.5", active && "text-primary")} />
                <span className="flex-1">{item.label}</span>
                {item.to === "/notifications" && unread > 0 && (
                  <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                    {unread}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="glass rounded-xl p-3">
            <p className="text-xs font-semibold">7 agents online</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Cash flow, expenses, invoices, health, tax, advisor and chat orchestration.
            </p>
          </div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
          </Button>
          <Link to="/notifications">
            <Button variant="ghost" size="icon" className="relative" aria-label="Alerts">
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
              )}
            </Button>
          </Link>
          <Link to="/chat">
            <Button className="gap-2">
              <Sparkles className="size-4" /> Ask your CFO
            </Button>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
