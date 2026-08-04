import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app-shell";
import { GlassPanel } from "@/components/kpi";
import { useSnapshot, useUpsertRow } from "@/lib/queries";
import { clearAllData } from "@/lib/seed";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Business profile — CFO.ai" },
      {
        name: "description",
        content: "Set your business name, industry, GSTIN and reporting currency for accurate AI analysis.",
      },
      { property: "og:title", content: "Business profile — CFO.ai" },
      { property: "og:description", content: "Tune how your AI CFO reports on your business." },
    ],
  }),
  component: SettingsPage,
});

const INDUSTRIES = [
  "Manufacturing",
  "Retail",
  "Services",
  "SaaS / Technology",
  "Hospitality",
  "Logistics",
  "Healthcare",
  "Other",
];

function SettingsPage() {
  const { data: snapshot } = useSnapshot();
  const upsert = useUpsertRow("business_profiles");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    industry: "Manufacturing",
    gstin: "",
    currency: "INR",
    address: "",
  });

  useEffect(() => {
    if (snapshot?.business) {
      setForm({
        name: snapshot.business.name ?? "",
        industry: snapshot.business.industry ?? "Manufacturing",
        gstin: snapshot.business.gstin ?? "",
        currency: snapshot.business.currency ?? "INR",
        address: snapshot.business.address ?? "",
      });
    }
  }, [snapshot?.business]);

  async function save() {
    try {
      const payload: Record<string, unknown> = { ...form };
      if (snapshot?.business?.id) payload["id"] = snapshot.business.id;
      await upsert.mutateAsync(payload);
      toast.success("Business profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    }
  }

  async function reset() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await clearAllData(data.user.id);
    await queryClient.invalidateQueries();
    toast.success("All financial data cleared");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business profile"
        description="These details shape how every agent reports on your company."
      />

      <GlassPanel title="Company details" subtitle="Used across dashboards, reports and AI answers">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs">Business name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Industry</Label>
            <Select
              value={form.industry}
              onValueChange={(industry) => setForm({ ...form, industry })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">GSTIN</Label>
            <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Reporting currency</Label>
            <Select value={form.currency} onValueChange={(currency) => setForm({ ...form, currency })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </div>
        <Button className="mt-5" onClick={save} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save profile"}
        </Button>
      </GlassPanel>

      <GlassPanel title="Danger zone" subtitle="Remove all financial records from this workspace">
        <Button variant="destructive" className="gap-2" onClick={reset}>
          <Trash2 className="size-4" /> Clear all financial data
        </Button>
      </GlassPanel>
    </div>
  );
}
