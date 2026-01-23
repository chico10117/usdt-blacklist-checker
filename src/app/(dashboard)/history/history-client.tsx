"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type SavedReportSummary = {
  id: string;
  address: string;
  riskScore: number;
  riskTier: "low" | "guarded" | "elevated" | "high" | "severe";
  confidence: number;
  window: unknown;
  createdAt: string;
};

type ListSavedReportsResponse = { reports: SavedReportSummary[] } | { error: string };

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function truncateAddress(address: string, start = 10, end = 8) {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function tierVariant(tier: SavedReportSummary["riskTier"]): React.ComponentProps<typeof Badge>["variant"] {
  if (tier === "low") return "success";
  if (tier === "guarded") return "secondary";
  if (tier === "elevated") return "warning";
  return "danger";
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; reports: SavedReportSummary[] }
  | { status: "error"; message: string };

export function HistoryClient() {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [deletingAll, setDeletingAll] = React.useState(false);
  const [confirmAll, setConfirmAll] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setState({ status: "loading" });
    setConfirmAll(false);
    setConfirmId(null);

    try {
      const res = await fetch("/api/saved-reports?limit=50", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ListSavedReportsResponse | null;

      if (!res.ok) {
        const message = json && "error" in json ? json.error : "Unable to load history.";
        setState({ status: "error", message });
        return;
      }

      if (!json || "error" in json || !Array.isArray(json.reports)) {
        setState({ status: "error", message: "Unexpected response from history API." });
        return;
      }

      setState({ status: "ready", reports: json.reports });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load history.";
      setState({ status: "error", message });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function deleteOne(id: string) {
    if (busyId || deletingAll) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/saved-reports/${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error((json && typeof json.error === "string" ? json.error : null) ?? "Unable to delete report.");

      setState((prev) => (prev.status === "ready" ? { status: "ready", reports: prev.reports.filter((r) => r.id !== id) } : prev));
      setConfirmId(null);
      toast.success("Report deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete report.";
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAll() {
    if (deletingAll || busyId) return;
    setDeletingAll(true);
    try {
      const res = await fetch("/api/saved-reports", { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error((json && typeof json.error === "string" ? json.error : null) ?? "Unable to delete all reports.");

      setState((prev) => (prev.status === "ready" ? { status: "ready", reports: [] } : prev));
      setConfirmAll(false);
      toast.success("All reports deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete all reports.";
      toast.error(message);
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Saved reports</CardTitle>
        {state.status === "ready" && state.reports.length > 0 && (
          <div className="flex items-center gap-2">
            {!confirmAll ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmAll(true)} disabled={deletingAll || Boolean(busyId)}>
                Delete all
              </Button>
            ) : (
              <>
                <Button variant="destructive" size="sm" onClick={() => deleteAll()} disabled={deletingAll || Boolean(busyId)}>
                  {deletingAll ? "Deleting…" : "Confirm delete all"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAll(false)}
                  disabled={deletingAll || Boolean(busyId)}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : state.status === "error" ? (
          <Alert variant="danger">
            <AlertTitle>Couldn&apos;t load history</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : state.reports.length === 0 ? (
          <Alert>
            <AlertTitle>No saved reports</AlertTitle>
            <AlertDescription>
              Run a screening on the home page and enable saving in <Link href="/settings" className="underline">Settings</Link> to store reports here.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-2xl border border-border/60">
            {state.reports.map((report, idx) => (
              <div key={report.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/history/${report.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                      {truncateAddress(report.address)}
                    </Link>
                    <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(report.createdAt)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={tierVariant(report.riskTier)} className="capitalize">
                        {report.riskTier}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Risk <span className="font-medium text-foreground">{report.riskScore}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Confidence <span className="font-medium text-foreground">{report.confidence}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/history/${report.id}`}>View</Link>
                    </Button>
                    {confirmId !== report.id ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmId(report.id)}
                        disabled={deletingAll || Boolean(busyId)}
                      >
                        Delete
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteOne(report.id)}
                          disabled={deletingAll || Boolean(busyId)}
                        >
                          {busyId === report.id ? "Deleting…" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmId(null)}
                          disabled={deletingAll || Boolean(busyId)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {idx < state.reports.length - 1 && <Separator className="mt-4 bg-border/60" />}
              </div>
            ))}
          </div>
        )}
        {state.status === "ready" && state.reports.length > 0 && (
          <div className="text-xs text-muted-foreground">Showing your latest 50 saved reports.</div>
        )}
      </CardContent>
    </Card>
  );
}

