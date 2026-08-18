import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  SOURCES,
  TARGETS,
  autoMap,
  buildRows,
  commitRows,
  detectTarget,
  parseFile,
  type ParsedFile,
  type SourceId,
  type TargetTable,
} from "@/lib/import";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import data — CFO.ai" },
      {
        name: "description",
        content:
          "Import your books from Tally, Zoho Books, Winman, QuickBooks or any CSV export and let the AI CFO agents analyse them instantly.",
      },
      { property: "og:title", content: "Import your accounting data — CFO.ai" },
      {
        property: "og:description",
        content: "Bring Tally, Zoho, Winman or plain CSV exports into your AI CFO in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

const NONE = "__none__";

function ImportPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SourceId>("auto");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [target, setTarget] = useState<TargetTable>("expenses");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const spec = TARGETS.find((t) => t.id === target)!;
  const preview = useMemo(
    () => (parsed ? buildRows(parsed, target, mapping) : null),
    [parsed, target, mapping],
  );

  async function handleFile(file: File) {
    try {
      const result = await parseFile(file);
      if (result.rows.length === 0) {
        toast.error("No readable rows found in that file");
        return;
      }
      const guessed = detectTarget(result.headers);
      setParsed(result);
      setImported(null);
      setTarget(guessed);
      setMapping(autoMap(result.headers, guessed));
      toast.success(`${result.rows.length} rows read from ${file.name}`);
    } catch {
      toast.error("Could not read that file. Try a CSV or Tally XML export.");
    }
  }

  function changeTarget(next: TargetTable) {
    setTarget(next);
    if (parsed) setMapping(autoMap(parsed.headers, next));
  }

  async function runImport() {
    if (!preview || preview.valid.length === 0) return;
    setBusy(true);
    try {
      const count = await commitRows(target, preview.valid);
      await queryClient.invalidateQueries();
      setImported(count);
      toast.success(`Imported ${count} records into ${spec.label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const missingRequired = spec.fields.filter((f) => f.required && !mapping[f.name]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import company data"
        description="Bring in your books from Tally, Zoho Books, Winman, QuickBooks or any spreadsheet export — the agents start analysing immediately."
      />

      <GlassPanel title="1 · Choose your source" subtitle="Only affects the hints we show — every format is parsed automatically">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                source === s.id
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-soft)]"
                  : "border-border hover:border-primary/40",
              )}
            >
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.hint}</p>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel title="2 · Upload the export" subtitle="CSV, TSV or Tally XML · processed privately in your browser">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <UploadCloud className="size-8 text-primary" />
          <p className="mt-3 text-sm font-semibold">Drag & drop your export here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tally day book XML, Zoho Books CSV, Winman GST export, or any CSV
          </p>
          <Button className="mt-4" variant="outline" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {parsed && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3">
            <FileSpreadsheet className="size-4.5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{parsed.fileName}</p>
              <p className="text-[11px] text-muted-foreground">
                {parsed.rows.length} rows · {parsed.headers.length} columns detected
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove file"
              onClick={() => {
                setParsed(null);
                setImported(null);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </GlassPanel>

      {parsed && (
        <GlassPanel title="3 · Map the columns" subtitle="We matched what we could — adjust anything that looks off">
          <div className="mb-4 max-w-xs">
            <Label className="mb-1.5 block text-xs">Import into</Label>
            <Select value={target} onValueChange={(v) => changeTarget(v as TargetTable)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spec.fields.map((field) => (
              <div key={field.name}>
                <Label className="mb-1.5 block text-xs">
                  {field.label}
                  {field.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <Select
                  value={mapping[field.name] ?? NONE}
                  onValueChange={(value) =>
                    setMapping((prev) => {
                      const next = { ...prev };
                      if (value === NONE) delete next[field.name];
                      else next[field.name] = value;
                      return next;
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not mapped" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not mapped</SelectItem>
                    {parsed.headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {parsed && preview && (
        <GlassPanel
          title="4 · Preview & confirm"
          subtitle={`${preview.valid.length} ready · ${preview.skipped} skipped`}
        >
          {missingRequired.length > 0 && (
            <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              Map the required fields first: {missingRequired.map((f) => f.label).join(", ")}
            </p>
          )}
          {preview.issues.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">
              {preview.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {spec.fields.map((f) => (
                    <th key={f.name} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.valid.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-border/70">
                    {spec.fields.map((f) => (
                      <td key={f.name} className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {String(row[f.name] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
                {preview.valid.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={spec.fields.length}>
                      Nothing importable yet — check your column mapping.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={runImport}
              disabled={busy || preview.valid.length === 0 || missingRequired.length > 0}
            >
              {busy ? "Importing…" : `Import ${preview.valid.length} records`}
            </Button>
            {imported !== null && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <CheckCircle2 className="size-4" /> {imported} records added
              </span>
            )}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
