"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

type WatchlistItem = {
  id: string;
  address: string;
  label: string | null;
  usdtBalance: string | null;
  createdAt: string;
  alertsEnabled: boolean;
  alertsMinAmountBase: string | null;
  alertsUpdatedAt: string | null;
};

type AlertEvent = {
  id: string;
  watchlistItemId: string;
  txHash: string;
  tokenContract: string;
  amountBase: string;
  fromAddress: string;
  toAddress: string;
  blockTsMs: number;
  createdAt: string;
  address: string;
  label: string | null;
};

type ListWatchlistResponse = { items: WatchlistItem[] } | { error: string };
type CreateWatchlistResponse = { item: WatchlistItem } | { error: string };
type ListAlertsResponse = { items: AlertEvent[] } | { error: string };
type UpdateAlertsResponse = { item: { id: string; alertsEnabled: boolean; alertsMinAmountBase: string | null; alertsUpdatedAt: string | null } } | { error: string };

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateTimeMs(ms: number) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return String(ms);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function truncateAddress(address: string, start = 10, end = 8) {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function formatBalance(balance: string) {
  const num = parseFloat(balance);
  if (Number.isNaN(num)) return balance;
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function baseUnitsToUsdt(baseUnits: string): string {
  const num = parseFloat(baseUnits);
  if (Number.isNaN(num)) return "0";
  return (num / 1_000_000).toFixed(2);
}

function formatUsdtAmount(amountBase: string): string {
  return `${baseUnitsToUsdt(amountBase)} USDT`;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: WatchlistItem[] }
  | { status: "error"; message: string };

type AlertsState =
  | { status: "loading" }
  | { status: "ready"; items: AlertEvent[] }
  | { status: "error"; message: string };

export function WatchlistClient() {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [alertsState, setAlertsState] = React.useState<AlertsState>({ status: "loading" });
  const [address, setAddress] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [updatingAlertsId, setUpdatingAlertsId] = React.useState<string | null>(null);
  const [minAmountInputs, setMinAmountInputs] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async (refreshBalances = false) => {
    setState({ status: "loading" });
    setConfirmId(null);
    setRemovingId(null);

    try {
      const url = refreshBalances ? "/api/watchlist?limit=200&refreshBalances=true" : "/api/watchlist?limit=200";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ListWatchlistResponse | null;

      if (!res.ok) {
        const message = json && "error" in json ? json.error : "Unable to load watchlist.";
        setState({ status: "error", message });
        return;
      }

      if (!json || "error" in json || !Array.isArray(json.items)) {
        setState({ status: "error", message: "Unexpected response from watchlist API." });
        return;
      }

      setState({ status: "ready", items: json.items });

      // Initialize min amount inputs
      const initialInputs: Record<string, string> = {};
      for (const item of json.items) {
        if (item.alertsMinAmountBase) {
          initialInputs[item.id] = baseUnitsToUsdt(item.alertsMinAmountBase);
        }
      }
      setMinAmountInputs(initialInputs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load watchlist.";
      setState({ status: "error", message });
    }
  }, []);

  const loadAlerts = React.useCallback(async () => {
    setAlertsState({ status: "loading" });

    try {
      const res = await fetch("/api/alerts?limit=200", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ListAlertsResponse | null;

      if (!res.ok) {
        const message = json && "error" in json ? json.error : "Unable to load alerts.";
        setAlertsState({ status: "error", message });
        return;
      }

      if (!json || "error" in json || !Array.isArray(json.items)) {
        setAlertsState({ status: "error", message: "Unexpected response from alerts API." });
        return;
      }

      setAlertsState({ status: "ready", items: json.items });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load alerts.";
      setAlertsState({ status: "error", message });
    }
  }, []);

  React.useEffect(() => {
    void load();
    void loadAlerts();
  }, [load, loadAlerts]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (adding || removingId) return;

    setAdding(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, label }),
      });
      const json = (await res.json().catch(() => null)) as CreateWatchlistResponse | null;

      if (!res.ok) {
        const message = json && "error" in json ? json.error : "Unable to add watchlist item.";
        throw new Error(message);
      }

      if (!json || "error" in json || !json.item) throw new Error("Unexpected response from watchlist API.");

      setState((prev) => (prev.status === "ready" ? { status: "ready", items: [json.item, ...prev.items] } : { status: "ready", items: [json.item] }));
      setAddress("");
      setLabel("");
      toast.success("Added to watchlist");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add watchlist item.";
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  async function removeItem(id: string) {
    if (adding || removingId) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error((json && typeof json.error === "string" ? json.error : null) ?? "Unable to remove item.");

      setState((prev) => (prev.status === "ready" ? { status: "ready", items: prev.items.filter((i) => i.id !== id) } : prev));
      setConfirmId(null);
      toast.success("Removed from watchlist");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove item.";
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  }

  async function updateAlerts(id: string, enabled: boolean, minAmountUsdt?: string) {
    if (updatingAlertsId) return;
    setUpdatingAlertsId(id);

    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(id)}/alerts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, minAmountUsdt }),
      });
      const json = (await res.json().catch(() => null)) as UpdateAlertsResponse | null;

      if (!res.ok) {
        const message = json && "error" in json ? json.error : "Unable to update alerts.";
        throw new Error(message);
      }

      if (!json || "error" in json || !json.item) throw new Error("Unexpected response from alerts API.");

      // Update local state
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        return {
          status: "ready",
          items: prev.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  alertsEnabled: json.item.alertsEnabled,
                  alertsMinAmountBase: json.item.alertsMinAmountBase,
                  alertsUpdatedAt: json.item.alertsUpdatedAt,
                }
              : item
          ),
        };
      });

      toast.success(enabled ? "Alerts enabled" : "Alerts disabled");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update alerts.";
      toast.error(message);
    } finally {
      setUpdatingAlertsId(null);
    }
  }

  // Group alerts by watchlistItemId for efficient lookup
  const alertsByWatchlistItemId = React.useMemo(() => {
    if (alertsState.status !== "ready") return new Map<string, AlertEvent[]>();

    const grouped = new Map<string, AlertEvent[]>();
    for (const alert of alertsState.items) {
      const existing = grouped.get(alert.watchlistItemId) ?? [];
      existing.push(alert);
      grouped.set(alert.watchlistItemId, existing);
    }

    // Sort each group by date (newest first)
    for (const [, alerts] of grouped) {
      alerts.sort((a, b) => b.blockTsMs - a.blockTsMs);
    }

    return grouped;
  }, [alertsState]);

  // Get global alerts (last 50)
  const globalAlerts = React.useMemo(() => {
    if (alertsState.status !== "ready") return [];
    return alertsState.items.slice(0, 50);
  }, [alertsState]);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Add address</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="text-sm font-medium text-foreground">TRON address</div>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="T…"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
              />
            </div>
            <div className="sm:col-span-1">
              <div className="text-sm font-medium text-foreground">Label (optional)</div>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Merchant A"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="sm:col-span-3 flex items-center gap-2">
              <Button type="submit" disabled={adding || Boolean(removingId)}>
                {adding ? "Adding…" : "Add to watchlist"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void load(true)} disabled={adding || Boolean(removingId)}>
                Refresh
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Recent alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alertsState.status === "loading" ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : alertsState.status === "error" ? (
            <Alert variant="danger">
              <AlertTitle>Couldn&apos;t load alerts</AlertTitle>
              <AlertDescription>{alertsState.message}</AlertDescription>
            </Alert>
          ) : globalAlerts.length === 0 ? (
            <Alert>
              <AlertTitle>No alerts yet</AlertTitle>
              <AlertDescription>Alerts will appear here when transactions are detected on watchlist addresses.</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Time</th>
                    <th className="pb-2 pr-4 font-medium">Address</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {globalAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-muted/50">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDateTimeMs(alert.blockTsMs)}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-col">
                          {alert.label && <span className="font-medium">{alert.label}</span>}
                          <span className="text-muted-foreground">{truncateAddress(alert.address)}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">{formatUsdtAmount(alert.amountBase)}</td>
                      <td className="py-2 pr-4">
                        <a
                          href={`https://tronscan.org/#/transaction/${encodeURIComponent(alert.txHash)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {truncateAddress(alert.txHash, 8, 8)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alertsState.items.length > 50 && (
                <div className="mt-2 text-xs text-muted-foreground">Showing latest 50 of {alertsState.items.length} alerts.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "loading" ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : state.status === "error" ? (
            <Alert variant="danger">
              <AlertTitle>Couldn&apos;t load watchlist</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : state.items.length === 0 ? (
            <Alert>
              <AlertTitle>No watchlist items</AlertTitle>
              <AlertDescription>Add an address above to track it for quick re-screening.</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-2xl border border-border/60">
              {state.items.map((item, idx) => {
                const itemAlerts = alertsByWatchlistItemId.get(item.id) ?? [];
                const topAlerts = itemAlerts.slice(0, 5);
                const isUpdatingAlerts = updatingAlertsId === item.id;

                return (
                  <div key={item.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/?address=${encodeURIComponent(item.address)}`}
                          className="group block"
                        >
                          {item.label && (
                            <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</div>
                          )}
                          <div className={`${item.label ? "text-sm text-muted-foreground" : "font-medium text-foreground"} group-hover:text-primary transition-colors`}>
                            {truncateAddress(item.address)}
                          </div>
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          {item.usdtBalance !== null && (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium text-foreground">{formatBalance(item.usdtBalance)}</span>
                              <span>USDT</span>
                            </span>
                          )}
                          {item.usdtBalance !== null && <span>•</span>}
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground break-all">{item.address}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {confirmId !== item.id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmId(item.id)}
                            disabled={adding || Boolean(removingId)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeItem(item.id)}
                              disabled={adding || Boolean(removingId)}
                            >
                              {removingId === item.id ? "Removing…" : "Confirm"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmId(null)}
                              disabled={adding || Boolean(removingId)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Alerts configuration */}
                    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={item.alertsEnabled}
                            onCheckedChange={(checked) => void updateAlerts(item.id, checked, minAmountInputs[item.id])}
                            disabled={isUpdatingAlerts}
                          />
                          <span className="text-sm font-medium">Alerts {item.alertsEnabled ? "enabled" : "disabled"}</span>
                        </div>
                        {item.alertsUpdatedAt && (
                          <span className="text-xs text-muted-foreground">Updated {formatDateTime(item.alertsUpdatedAt)}</span>
                        )}
                      </div>

                      {item.alertsEnabled && (
                        <div className="mt-3 flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground">Min. amount (USDT)</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={minAmountInputs[item.id] ?? ""}
                              onChange={(e) => setMinAmountInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              disabled={isUpdatingAlerts}
                              className="h-8"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => void updateAlerts(item.id, true, minAmountInputs[item.id])}
                            disabled={isUpdatingAlerts}
                          >
                            {isUpdatingAlerts ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      )}

                      {/* Recent alerts for this item */}
                      {topAlerts.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/60">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Recent alerts</div>
                          <div className="space-y-2">
                            {topAlerts.map((alert) => (
                              <div key={alert.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{formatUsdtAmount(alert.amountBase)}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-muted-foreground">{formatDateTimeMs(alert.blockTsMs)}</span>
                                </div>
                                <a
                                  href={`https://tronscan.org/#/transaction/${encodeURIComponent(alert.txHash)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  View tx
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {idx < state.items.length - 1 && <Separator className="mt-4 bg-border/60" />}
                  </div>
                );
              })}
            </div>
          )}
          {state.status === "ready" && state.items.length > 0 && (
            <div className="text-xs text-muted-foreground">Showing up to your latest 200 watchlist items.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
