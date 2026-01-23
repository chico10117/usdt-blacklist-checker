"use client";

import * as React from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

type UserSettingsResponse =
  | { loggingEnabled: boolean; persistenceAvailable: boolean }
  | { error: string };

type LoadState =
  | { status: "loading" }
  | { status: "ready"; loggingEnabled: boolean; persistenceAvailable: boolean }
  | { status: "error"; message: string };

export function SettingsClient() {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<null | { kind: "success" | "error"; message: string }>(null);
  const clearSaveMessageTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading" });
      setSaveMessage(null);

      try {
        const res = await fetch("/api/user-settings", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as UserSettingsResponse | null;

        if (!res.ok) {
          const message = json && "error" in json ? json.error : "Unable to load settings.";
          if (!cancelled) setState({ status: "error", message });
          return;
        }

        if (!json || "error" in json) {
          if (!cancelled) setState({ status: "error", message: "Unexpected response from settings API." });
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            loggingEnabled: Boolean(json.loggingEnabled),
            persistenceAvailable: Boolean(json.persistenceAvailable),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load settings.";
        if (!cancelled) setState({ status: "error", message });
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (clearSaveMessageTimeoutRef.current !== null) {
        window.clearTimeout(clearSaveMessageTimeoutRef.current);
        clearSaveMessageTimeoutRef.current = null;
      }
    };
  }, []);

  async function updateLoggingEnabled(nextValue: boolean) {
    if (state.status !== "ready") return;
    if (!state.persistenceAvailable) return;
    if (saving) return;

    const prevValue = state.loggingEnabled;
    setSaving(true);
    setSaveMessage(null);
    setState({ ...state, loggingEnabled: nextValue });

    try {
      const res = await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loggingEnabled: nextValue }),
      });
      const json = (await res.json().catch(() => null)) as UserSettingsResponse | null;

      if (!res.ok) {
        const message = json && "error" in json ? json.error : "Unable to save setting.";
        throw new Error(message);
      }

      if (!json || "error" in json) throw new Error("Unexpected response from settings API.");

      setState({
        status: "ready",
        loggingEnabled: Boolean(json.loggingEnabled),
        persistenceAvailable: Boolean(json.persistenceAvailable),
      });
      setSaveMessage({ kind: "success", message: "Saved." });
      toast.success("Settings saved");
      if (clearSaveMessageTimeoutRef.current !== null) window.clearTimeout(clearSaveMessageTimeoutRef.current);
      clearSaveMessageTimeoutRef.current = window.setTimeout(() => {
        setSaveMessage(null);
        clearSaveMessageTimeoutRef.current = null;
      }, 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save setting.";
      setState({ ...state, loggingEnabled: prevValue });
      setSaveMessage({ kind: "error", message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
        <CardDescription>Choose whether this app can store your screening history for your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {state.status === "loading" ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ) : state.status === "error" ? (
          <Alert variant="danger">
            <AlertTitle>Couldn&apos;t load settings</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            {!state.persistenceAvailable && (
              <Alert variant="warning">
                <AlertTitle>Saving is unavailable</AlertTitle>
                <AlertDescription>
                  This deployment does not have persistence enabled, so screening history can’t be saved.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">Save screening history</div>
                <div className="mt-1 text-sm text-muted-foreground">Default is off. You can change this any time.</div>
              </div>
              <Switch
                checked={state.loggingEnabled}
                disabled={saving || !state.persistenceAvailable}
                onCheckedChange={(v) => updateLoggingEnabled(v)}
                aria-label="Save screening history"
              />
            </div>

            {saving && <div className="text-sm text-muted-foreground">Saving…</div>}

            <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">What gets stored</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  When enabled: we may store the address you screened and the screening result (risk score/tier and
                  related metadata) under your account as history.
                </li>
                <li>
                  When disabled: we don’t save your screened addresses or results on our server (checks are
                  session-only).
                </li>
                <li>We never ask for or store seed phrases or private keys.</li>
              </ul>
              <div className="mt-3 text-xs">
                Note: the address you enter is still sent to public TRON data providers to compute results, regardless of
                this setting.
              </div>
            </div>

            {saveMessage?.kind === "success" && (
              <div className="text-sm text-emerald-700 dark:text-emerald-300">{saveMessage.message}</div>
            )}
            {saveMessage?.kind === "error" && (
              <Alert variant="danger">
                <AlertTitle>Couldn&apos;t save setting</AlertTitle>
                <AlertDescription>{saveMessage.message}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
