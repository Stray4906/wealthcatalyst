import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/kpi";
import { useNotifications, useUpsertRow, useSnapshot } from "@/lib/queries";
import { advisorAgent } from "@/lib/agents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Alerts — CFO.ai" },
      {
        name: "description",
        content: "Proactive financial alerts raised by your AI CFO agents, from cash risk to overdue invoices.",
      },
      { property: "og:title", content: "Alerts — CFO.ai" },
      { property: "og:description", content: "Never miss a financial risk signal again." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const { data: snapshot } = useSnapshot();
  const upsert = useUpsertRow("notifications");
  const queryClient = useQueryClient();

  const live = snapshot ? advisorAgent(snapshot) : [];

  async function markAllRead() {
    const unread = (notifications ?? []).filter((n) => !n.read);
    await Promise.all(unread.map((n) => upsert.mutateAsync({ id: n.id, read: true })));
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.success("All alerts marked as read");
  }

  const iconFor = (severity: string) =>
    severity === "critical" ? ShieldAlert : severity === "warning" ? AlertTriangle : Info;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Your agents watch the books continuously and raise a flag the moment something changes."
        action={
          <Button variant="outline" className="gap-2" onClick={markAllRead}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (notifications ?? []).length === 0 ? (
        <EmptyState
          title="No stored alerts"
          description="Live agent signals appear below. Saved alerts show up here as your data grows."
        />
      ) : (
        <ul className="space-y-3">
          {(notifications ?? []).map((n) => {
            const Icon = iconFor(n.severity);
            return (
              <li
                key={n.id}
                className={cn(
                  "surface flex items-start gap-4 p-4",
                  !n.read && "border-primary/40 bg-primary-soft/30",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    n.severity === "critical"
                      ? "bg-destructive/12 text-destructive"
                      : n.severity === "warning"
                        ? "bg-warning/12 text-warning"
                        : "bg-primary-soft text-primary",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(n.created_at)}</p>
                </div>
                {!n.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void upsert.mutateAsync({ id: n.id, read: true })}
                  >
                    Mark read
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Bell className="size-4 text-primary" /> Live agent signals
        </h2>
        <ul className="space-y-3">
          {live.map((rec) => (
            <li key={rec.id} className="surface p-4">
              <p className="text-xs font-semibold text-primary">{rec.agent}</p>
              <p className="mt-1 text-sm font-medium">{rec.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{rec.detail}</p>
            </li>
          ))}
          {live.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No risk signals right now — your agents are happy.
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
