"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type SavedReportDetail = {
  id: string;
  address: string;
  riskScore: number;
  riskTier: "low" | "guarded" | "elevated" | "high" | "severe";
  confidence: number;
  window: unknown;
  reportJson: unknown;
  createdAt: string;
};

type GetSavedReportResponse = SavedReportDetail | { error: string };

function tronscanTxUrl(txHash: string) {
  return `https://tronscan.org/#/transaction/${txHash}`;
}
function tronscanAddressUrl(address: string) {
  return `https://tronscan.org/#/address/${address}`;
}
function tronscanContractUrl(contractAddress: string) {
  return `https://tronscan.org/#/contract/${contractAddress}`;
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function tierVariant(tier: SavedReportDetail["riskTier"]): React.ComponentProps<typeof Badge>["variant"] {
  if (tier === "low") return "success";
  if (tier === "guarded") return "secondary";
  if (tier === "elevated") return "warning";
  return "danger";
}

function DataRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="break-all text-sm text-foreground underline underline-offset-4">
          {value}
        </a>
      ) : (
        <div className="break-all text-sm text-foreground">{value}</div>
      )}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function extractString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function extractEvidenceLinks(reportJson: unknown): Array<{ label: string; href: string }> {
  const out: Array<{ label: string; href: string }> = [];
  const json = asRecord(reportJson);
  if (!json) return out;

  const checks = asRecord(json.checks);
  if (!checks) return out;

  const tronscan = asRecord(checks.tronscan);
  const onchain = asRecord(checks.onchain);

  for (const check of [tronscan, onchain]) {
    const evidence = check ? asRecord(check.evidence) : null;
    if (!evidence) continue;
    const txHash = extractString(evidence.txHash);
    const address = extractString(json.address);
    const contractAddress = extractString(evidence.contractAddress);
    if (address) out.push({ label: "Address (TronScan)", href: tronscanAddressUrl(address) });
    if (contractAddress) out.push({ label: "Contract (TronScan)", href: tronscanContractUrl(contractAddress) });
    if (txHash) out.push({ label: "Transaction (TronScan)", href: tronscanTxUrl(txHash) });
  }

  const sanctions = asRecord(checks.sanctions);
  const matches = sanctions ? sanctions.matches : null;
  if (Array.isArray(matches)) {
    for (const match of matches) {
      const m = asRecord(match);
      const sources = m ? m.sources : null;
      if (!Array.isArray(sources)) continue;
      for (const source of sources) {
        const s = asRecord(source);
        const url = s ? extractString(s.url) : null;
        const name = s ? extractString(s.name) : null;
        if (url) out.push({ label: name ? `Sanctions source: ${name}` : "Sanctions source", href: url });
      }
    }
  }

  const volume = asRecord(checks.volume);
  const stats = volume ? asRecord(volume.stats) : null;
  if (stats) {
    const largestInbound = asRecord(stats.largestInbound);
    const largestOutbound = asRecord(stats.largestOutbound);
    const inTx = largestInbound ? extractString(largestInbound.txHash) : null;
    const outTx = largestOutbound ? extractString(largestOutbound.txHash) : null;
    if (inTx) out.push({ label: "Largest inbound tx (TronScan)", href: tronscanTxUrl(inTx) });
    if (outTx) out.push({ label: "Largest outbound tx (TronScan)", href: tronscanTxUrl(outTx) });
  }

  const exposure = asRecord(checks.exposure1hop);
  const counterparties = exposure ? exposure.counterparties : null;
  if (Array.isArray(counterparties)) {
    for (const cp of counterparties) {
      const c = asRecord(cp);
      if (!c) continue;
      const flags = asRecord(c.flags);
      const flagged = flags ? Boolean(flags.sanctioned) || Boolean(flags.usdtBlacklisted) : false;
      if (!flagged) continue;
      const addr = extractString(c.address);
      const tx = extractString(c.sampleTxHash);
      if (addr) out.push({ label: "Flagged counterparty (TronScan)", href: tronscanAddressUrl(addr) });
      if (tx) out.push({ label: "Sample tx (TronScan)", href: tronscanTxUrl(tx) });
    }
  }

  const unique = new Map<string, { label: string; href: string }>();
  for (const item of out) unique.set(item.href, item);
  return [...unique.values()];
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; report: SavedReportDetail; evidence: Array<{ label: string; href: string }> }
  | { status: "error"; message: string };

export function ReportDetailClient({ reportId }: { reportId: string }) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading" });
      setConfirmDelete(false);
      try {
        const res = await fetch(`/api/saved-reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as GetSavedReportResponse | null;
        if (!res.ok) {
          const message = json && "error" in json ? json.error : "Unable to load report.";
          if (!cancelled) setState({ status: "error", message });
          return;
        }
        if (!json || "error" in json) {
          if (!cancelled) setState({ status: "error", message: "Unexpected response from report API." });
          return;
        }
        const evidence = extractEvidenceLinks(json.reportJson);
        if (!cancelled) setState({ status: "ready", report: json, evidence });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load report.";
        if (!cancelled) setState({ status: "error", message });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function deleteThisReport() {
    if (state.status !== "ready") return;
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/saved-reports/${encodeURIComponent(state.report.id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error((json && typeof json.error === "string" ? json.error : null) ?? "Unable to delete report.");
      toast.success("Report deleted");
      window.location.href = "/history";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete report.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href="/history" className="underline">
              Back to history
            </Link>
          </p>
        </div>
        {state.status === "ready" && (
          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleting}>
                Delete
              </Button>
            ) : (
              <>
                <Button variant="destructive" onClick={() => deleteThisReport()} disabled={deleting}>
                  {deleting ? "Deleting…" : "Confirm delete"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {state.status === "loading" ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" ? (
        <Alert variant="danger">
          <AlertTitle>Couldn&apos;t load report</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 break-all">{state.report.address}</div>
                <Badge variant={tierVariant(state.report.riskTier)} className="capitalize">
                  {state.report.riskTier}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataRow label="Address (TronScan)" value={state.report.address} href={tronscanAddressUrl(state.report.address)} />
              <Separator className="bg-border/60" />
              <DataRow label="Saved at" value={formatDateTime(state.report.createdAt)} />
              <Separator className="bg-border/60" />
              <DataRow label="Risk score" value={String(state.report.riskScore)} />
              <Separator className="bg-border/60" />
              <DataRow label="Confidence" value={String(state.report.confidence)} />
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Evidence links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.evidence.length === 0 ? (
                <div className="text-sm text-muted-foreground">No evidence links were detected in this saved report.</div>
              ) : (
                <ul className="space-y-2">
                  {state.evidence.map((e) => (
                    <li key={e.href}>
                      <a href={e.href} target="_blank" rel="noreferrer" className="text-sm text-foreground underline underline-offset-4">
                        {e.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <AccordionItem value="json" className="border-none">
              <AccordionTrigger className="px-4">Full saved JSON</AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <pre className="max-h-[60vh] overflow-auto rounded-xl border border-border/60 bg-background/50 p-4 text-xs text-foreground">
                  {JSON.stringify(state.report.reportJson, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
}

