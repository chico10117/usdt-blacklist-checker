"use client";

import * as React from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type WatchlistItem = {
  id: string;
  address: string;
  label: string | null;
  createdAt: string;
};

type ListWatchlistResponse = { items: WatchlistItem[] } | { error: string };
type CreateWatchlistResponse = { item: WatchlistItem } | { error: string };

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function truncateAddress(address: string, start = 10, end = 8) {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: WatchlistItem[] }
  | { status: "error"; message: string };

export function WatchlistClient() {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [address, setAddress] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setState({ status: "loading" });
    setConfirmId(null);
    setRemovingId(null);

    try {
      const res = await fetch("/api/watchlist?limit=200", { cache: "no-store" });
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load watchlist.";
      setState({ status: "error", message });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

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
              <Button type="button" variant="outline" onClick={() => void load()} disabled={adding || Boolean(removingId)}>
                Refresh
              </Button>
            </div>
          </form>
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
              {state.items.map((item, idx) => (
                <div key={item.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{truncateAddress(item.address)}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {item.label ? `${item.label} • ` : ""}
                        {formatDateTime(item.createdAt)}
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
                  {idx < state.items.length - 1 && <Separator className="mt-4 bg-border/60" />}
                </div>
              ))}
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
