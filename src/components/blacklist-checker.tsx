"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SignedIn, useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USDT_TRC20_CONTRACT } from "@/lib/tron";
import { getMessages } from "@/lib/i18n";
import { validateTronAddress } from "@/lib/validators";

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────────── */

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "danger";

type Evidence = {
  contractAddress: string;
  txHash?: string;
  timestampIso?: string;
  method?: "getBlackListStatus" | "isBlackListed";
  raw?: string;
  fullHost?: string;
};

type CheckResult =
  | { ok: true; blacklisted: boolean; evidence?: Evidence }
  | { ok: false; blacklisted: false; error: string };

type ApiResponse = {
  address: string;
  isValid: boolean;
  access?: { authenticated: boolean };
  balance?: { ok: true; usdt: string; usdtBaseUnits: string } | { ok: false; error: string };
  checks: {
    tronscan: CheckResult;
    onchain: CheckResult;
    sanctions?: {
      ok: boolean;
      matched: boolean;
      error?: string;
      matches?: Array<{ address: string; sources: Array<{ url: string; name?: string; context?: string }> }>;
      dataset?: { generatedAtIso: string; sourceUrls: string[]; addressCount: number };
    };
    entity?:
      | {
          ok: true;
          kind: "exchange" | "particular" | "unknown";
          label: string;
          confidence: number; // 0..1
          reasons: string[];
          subjectTag?: { publicTag?: string };
          outbound?: {
            totalOutboundAmount: string;
            exchangeTaggedShare: number;
            top: Array<{ address: string; outboundAmount: string; outboundTxCount: number; publicTag?: string; isExchangeTagged: boolean }>;
          };
        }
      | { ok: false; error: string };
    volume?:
      | {
          ok: true;
          stats: {
            windows: {
              d7: { inbound: { amount: string; txCount: number }; outbound: { amount: string; txCount: number } };
              d30: { inbound: { amount: string; txCount: number }; outbound: { amount: string; txCount: number } };
              d90: { inbound: { amount: string; txCount: number }; outbound: { amount: string; txCount: number } };
            };
            largestInbound?: { amount: string; txHash: string; from: string; timestampIso: string };
            largestOutbound?: { amount: string; txHash: string; to: string; timestampIso: string };
          };
          notices: string[];
        }
      | { ok: false; error: string; locked?: boolean };
    exposure1hop?:
      | {
          ok: true;
          window: { lookbackDays: number };
          inbound: { totalInboundAmount: string; totalInboundTxCount: number };
          counterparties: Array<{
            address: string;
            inboundAmount: string;
            inboundTxCount: number;
            lastSeenIso: string;
            sampleTxHash?: string;
            flags: { sanctioned: boolean; usdtBlacklisted: boolean };
          }>;
          summary: {
            anyCounterpartySanctioned: boolean;
            anyCounterpartyBlacklisted: boolean;
            flaggedInboundShare: number;
            topCounterpartyShare: number;
            flaggedCounterpartyCount: number;
          };
          notices: string[];
        }
      | { ok: false; error: string; locked?: boolean };
    tracing2hop?:
      | {
          ok: true;
          anyFlagged: boolean;
          window: { lookbackDays: number; topN: number; sampleK: number };
          paths: Array<{ viaCounterparty: string; sources: Array<{ address: string; flags: { sanctioned: boolean; usdtBlacklisted: boolean } }> }>;
          notices: string[];
        }
      | { ok: false; error: string; locked?: boolean };
    heuristics?:
      | {
          ok: true;
          findings: Array<{ key: string; label: string; severity: "info" | "warning" | "danger" }>;
          parameters: Record<string, unknown>;
        }
      | { ok: false; error: string; locked?: boolean };
  };
  consensus: {
    status: "blacklisted" | "not_blacklisted" | "inconclusive";
    match: boolean;
  };
  risk?: {
    score: number;
    tier: "low" | "guarded" | "elevated" | "high" | "severe";
    confidence: number; // 0..100
    breakdown: Array<{ key: string; label: string; points: number; evidence?: string[] }>;
  };
  timestamps: { checkedAtIso: string };
  notices: string[];
};

type LoadState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; data: ApiResponse }
  | { state: "error"; message: string; status?: number; details?: string };

/* ────────────────────────────────────────────────────────────────────────────
 * Animation variants (respect reduced motion)
 * ──────────────────────────────────────────────────────────────────────────── */

const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Helper functions
 * ──────────────────────────────────────────────────────────────────────────── */

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
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function truncateAddress(address: string, start = 8, end = 6) {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function SignedInAutoRerun({
  enabled,
  normalizedAddress,
  shouldRerun,
  onRerun,
}: {
  enabled: boolean;
  normalizedAddress: string;
  shouldRerun: boolean;
  onRerun: (address: string) => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const prevSignedIn = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (!isLoaded) return;

    const prev = prevSignedIn.current;
    prevSignedIn.current = isSignedIn;

    if (prev === false && isSignedIn && shouldRerun) onRerun(normalizedAddress);
  }, [enabled, isLoaded, isSignedIn, shouldRerun, normalizedAddress, onRerun]);

  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small presentational components (defined inline per request)
 * ──────────────────────────────────────────────────────────────────────────── */

function InlineCopyButton({ value, size = "sm" }: { value: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = React.useState(false);
  const sizeClasses = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconClasses = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      className={`${sizeClasses} inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Failed to copy");
        }
      }}
    >
      {copied ? (
        <Check className={`${iconClasses} text-success`} />
      ) : (
        <Copy className={iconClasses} />
      )}
    </button>
  );
}

function TrustBadge({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-4 flex items-center gap-3 ${className ?? ""}`}>
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function DataRow({
  label,
  value,
  copyValue,
  href,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  copyValue?: string;
  href?: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  const displayValue = truncate ? truncateAddress(value) : value;
  const textClasses = mono ? "font-mono text-[13px]" : "text-sm";

  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-3 py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="min-w-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${textClasses} inline-flex items-center gap-1.5 break-all text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary`}
          >
            {displayValue}
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
        ) : (
          <div className={`${textClasses} break-all text-foreground`}>{displayValue}</div>
        )}
      </div>
      {copyValue && (
        <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <InlineCopyButton value={copyValue} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Status Banner
 * ──────────────────────────────────────────────────────────────────────────── */

function StatusBanner({ data }: { data: ApiResponse }) {
  const status = data.consensus.status;

  if (status === "blacklisted") {
    return (
      <motion.div
        {...fadeInUp}
        transition={{ duration: 0.15 }}
        className="rounded-sm bg-danger p-5"
      >
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-white/20">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-white">
              Blacklisted for USDT on TRON
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              This address is blacklisted for USDT (TRC20). Transfers from this address will likely fail.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (status === "not_blacklisted") {
    return (
      <motion.div
        {...fadeInUp}
        transition={{ duration: 0.15 }}
        className="rounded-sm bg-success p-5"
      >
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-white/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-white">
              Not Blacklisted
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              No blacklist record found for USDT on TRON at the time of this check.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...fadeInUp}
      transition={{ duration: 0.15 }}
      className="rounded-sm bg-warning p-5"
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-black/10">
          <AlertTriangle className="h-6 w-6 text-warning-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-warning-foreground">
            Inconclusive
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-warning-foreground/80">
            Could not verify via both methods due to network issues. Please try again.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Method Card (evidence display)
 * ──────────────────────────────────────────────────────────────────────────── */

function MethodCard({
  title,
  description,
  result,
}: {
  title: string;
  description: string;
  result: CheckResult;
}) {
  const ok = result.ok;
  const blacklisted = ok ? result.blacklisted : false;
  const evidence = ok ? result.evidence : undefined;

  const statusConfig = !ok
    ? { label: "Unavailable", variant: "warning" as BadgeVariant, accentClass: "accent-bar-warning" }
    : blacklisted
      ? { label: "Blacklisted", variant: "danger" as BadgeVariant, accentClass: "accent-bar-danger" }
      : { label: "Clear", variant: "success" as BadgeVariant, accentClass: "accent-bar-success" };

  return (
    <motion.div {...fadeInUp} transition={{ duration: 0.15 }}>
      <Card className={`h-full overflow-hidden accent-bar ${statusConfig.accentClass}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
            </div>
            <Badge variant={statusConfig.variant}>
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          {!ok ? (
            <div className="rounded-sm bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              {result.error}
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              <DataRow
                label="Contract"
                value={evidence?.contractAddress ?? USDT_TRC20_CONTRACT}
                copyValue={evidence?.contractAddress ?? USDT_TRC20_CONTRACT}
                href={tronscanContractUrl(evidence?.contractAddress ?? USDT_TRC20_CONTRACT)}
                mono
                truncate
              />
              {evidence?.txHash && (
                <DataRow
                  label="Blacklist Transaction"
                  value={evidence.txHash}
                  copyValue={evidence.txHash}
                  href={tronscanTxUrl(evidence.txHash)}
                  mono
                  truncate
                />
              )}
              {evidence?.timestampIso && (
                <DataRow label="Indexed At" value={formatDateTime(evidence.timestampIso)} />
              )}
              {evidence?.method && <DataRow label="Method" value={evidence.method} mono />}
              {evidence?.raw && <DataRow label="Raw Result" value={evidence.raw} mono />}
              {evidence?.fullHost && <DataRow label="Node" value={evidence.fullHost} />}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Scam Warning Alert
 * ──────────────────────────────────────────────────────────────────────────── */

function ScamWarningAlert() {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ duration: 0.15, delay: 0.08 }}
      className="rounded-sm border-l-2 border-l-danger bg-danger-muted p-4"
    >
      <div className="flex gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-medium text-foreground">Scam Warning</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            No legitimate service can &quot;unblacklist&quot; an address for a fee. Never share your seed phrase.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function SaveReportControl({ report }: { report: ApiResponse }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [settings, setSettings] = React.useState<{ loggingEnabled: boolean; persistenceAvailable: boolean } | null>(null);
  const [saveState, setSaveState] = React.useState<
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; id?: string }
  >({ state: "idle" });

  React.useEffect(() => {
    setSaveState({ state: "idle" });
  }, [report.address, report.timestamps.checkedAtIso]);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/user-settings", { credentials: "include" });
        const json = (await res.json().catch(() => null)) as unknown;
        if (!res.ok || !json || typeof json !== "object") return;

        const obj = json as Record<string, unknown>;
        if (typeof obj.loggingEnabled !== "boolean" || typeof obj.persistenceAvailable !== "boolean") return;
        if (cancelled) return;
        setSettings({ loggingEnabled: obj.loggingEnabled, persistenceAvailable: obj.persistenceAvailable });
      } catch {
        // ignore
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!report.access?.authenticated) return null;

  const canSave = Boolean(settings?.persistenceAvailable && settings.loggingEnabled);

  async function saveReport() {
    if (saveState.state === "saving" || saveState.state === "saved") return;

    setSaveState({ state: "saving" });
    try {
      const res = await fetch("/api/saved-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: report.address, report }),
      });

      const json = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const err = json && typeof json === "object" ? (json as Record<string, unknown>).error : null;
        toast.error(typeof err === "string" ? err : `Save failed (${res.status}).`);
        setSaveState({ state: "idle" });
        return;
      }

      const id = json && typeof json === "object" ? (json as Record<string, unknown>).id : null;
      toast.success("Report saved.");
      setSaveState({ state: "saved", id: typeof id === "string" ? id : undefined });
    } catch {
      toast.error("Network error.");
      setSaveState({ state: "idle" });
    }
  }

  const saving = saveState.state === "saving";
  const saved = saveState.state === "saved";

  return (
    <motion.div {...fadeInUp} transition={{ duration: 0.15 }}>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Save this report</div>
            <div className="mt-1 text-sm text-muted-foreground">Stores this analysis under your account history.</div>
            {!settings && <div className="mt-1 text-xs text-muted-foreground">Checking save settings...</div>}
            {settings && !settings.persistenceAvailable && (
              <div className="mt-1 text-xs text-muted-foreground">Report saving is unavailable on this deployment.</div>
            )}
            {settings?.persistenceAvailable && settings && !settings.loggingEnabled && (
              <div className="mt-1 text-xs text-muted-foreground">Enable report saving in Settings to use this button.</div>
            )}
          </div>
          <Button type="button" size="sm" onClick={saveReport} disabled={saving || saved || !canSave}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              "Save"
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Main Component
 * ──────────────────────────────────────────────────────────────────────────── */

// Helper to format volume amounts to 2 decimal places
function formatVolumeAmount(amountStr: string): string {
  // Remove thousand separators, parse as number, format to 2 decimals, then add separators back
  const num = parseFloat(amountStr.replace(/,/g, ""));
  if (isNaN(num)) return amountStr;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BlacklistChecker() {
  const m = getMessages("en");
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const searchParams = useSearchParams();

  const [address, setAddress] = React.useState("");
  const [validation, setValidation] = React.useState<ReturnType<typeof validateTronAddress> | null>(null);
  const [load, setLoad] = React.useState<LoadState>({ state: "idle" });

  // Pre-fill address from URL params (e.g., from watchlist link)
  React.useEffect(() => {
    const addressParam = searchParams.get("address");
    if (addressParam && !address) {
      setAddress(addressParam);
    }
  }, [searchParams, address]);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      if (!address.trim()) return setValidation(null);
      setValidation(validateTronAddress(address));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [address]);

  const normalizedAddress = validation?.normalized ?? address.trim();
  const isValid = validation?.ok ?? false;

  function isApiResponse(value: unknown): value is ApiResponse {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    const consensus = v.consensus as Record<string, unknown> | undefined;
    const timestamps = v.timestamps as Record<string, unknown> | undefined;
    const checks = v.checks as Record<string, unknown> | undefined;
    const risk = v.risk as Record<string, unknown> | undefined;
    return (
      typeof v.address === "string" &&
      typeof v.isValid === "boolean" &&
      typeof consensus?.status === "string" &&
      typeof consensus?.match === "boolean" &&
      typeof timestamps?.checkedAtIso === "string" &&
      typeof checks === "object" &&
      typeof risk?.score === "number"
    );
  }

  async function runCheck(nextAddress: string) {
    const v = validateTronAddress(nextAddress);
    setValidation(v);
    if (!v.ok) return;

    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: v.normalized }),
      });

      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const parsedObj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        const notices = parsedObj?.notices;
        const checks = parsedObj?.checks;
        const tronscanError =
          checks && typeof checks === "object"
            ? ((checks as Record<string, unknown>).tronscan as Record<string, unknown> | undefined)?.error
            : undefined;

        const message =
          (parsedObj && typeof parsedObj.error === "string" ? parsedObj.error : null) ||
          (Array.isArray(notices) && typeof notices[0] === "string" ? notices[0] : null) ||
          (typeof tronscanError === "string" ? tronscanError : null) ||
          `Request failed (${res.status}).`;
        setLoad({ state: "error", message, status: res.status, details: text });
        return;
      }

      if (!isApiResponse(parsed)) {
        setLoad({ state: "error", message: "Unexpected response from server.", details: text });
        return;
      }
      setLoad({ state: "success", data: parsed });
    } catch (error) {
      setLoad({
        state: "error",
        message: error instanceof Error ? error.message : "Network error.",
      });
    }
  }

  const consensus = load.state === "success" ? load.data.consensus : null;
  const shouldAutoRerunAfterSignIn =
    load.state === "success" &&
    load.data.access?.authenticated === false &&
    Boolean(load.data.checks?.volume && "ok" in load.data.checks.volume && load.data.checks.volume.ok === false);

  return (
    <div className="space-y-8">
      {clerkEnabled && (
        <SignedIn>
          <SignedInAutoRerun
            enabled={clerkEnabled}
            normalizedAddress={normalizedAddress}
            shouldRerun={isValid && shouldAutoRerunAfterSignIn}
            onRerun={(addr) => {
              toast.message("Signed in — loading enhanced checks...");
              runCheck(addr);
            }}
          />
        </SignedIn>
      )}

      {/* Hero Section */}
      <section className="mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {m.title}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            {m.subtitle}
          </p>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          <TrustBadge icon={ShieldCheck}>{m.noKeysBadge}</TrustBadge>
          <TrustBadge icon={EyeOff}>{m.noTrackingBadge}</TrustBadge>
        </motion.div>
      </section>

      {/* Input Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="mx-auto mt-8 max-w-2xl sm:mt-10"
      >
        <Card className="overflow-hidden">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Check Any TRON Address</CardTitle>
                <CardDescription className="mt-0.5 leading-relaxed">
                  Only paste a public address. Never share seed phrases or private keys.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Input Group */}
            <div className="space-y-3">
              <label htmlFor="tron-address" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.inputLabel}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    id="tron-address"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={m.inputPlaceholder}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-12 border-b-2 border-border bg-transparent pr-10 font-mono text-[15px] transition-colors placeholder:font-sans placeholder:text-muted-foreground/60 focus-visible:border-primary"
                    aria-invalid={address.trim().length > 0 && !isValid}
                  />
                  {address && (
                    <button
                      type="button"
                      className="absolute right-0 top-1/2 -translate-y-1/2 rounded-sm p-2 text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setAddress("")}
                      aria-label="Clear input"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setAddress(text);
                      toast.success("Pasted from clipboard");
                    } catch {
                      toast.error("Unable to access clipboard");
                    }
                  }}
                >
                  {m.pasteCta}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setAddress("TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7")}
                >
                  {m.exampleCta}
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 min-w-[100px] gap-2"
                  onClick={() => runCheck(normalizedAddress)}
                  disabled={load.state === "loading" || !normalizedAddress || (validation !== null && !validation.ok)}
                >
                  {load.state === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking</span>
                    </>
                  ) : (
                    <>
                      <span>{m.checkCta}</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Validation Feedback */}
              <div className="min-h-[20px] pt-1">
                {validation && !validation.ok ? (
                  <p className="text-sm text-danger">{validation.error}</p>
                ) : validation && validation.ok ? (
                  <p className="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Valid TRON address
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tip: double-check the first and last 4 characters
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Contract Reference */}
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">USDT Contract:</span>
                <a
                  href={tronscanContractUrl(USDT_TRC20_CONTRACT)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-primary"
                >
                  {USDT_TRC20_CONTRACT}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <InlineCopyButton value={USDT_TRC20_CONTRACT} />
              </div>
              <a
                href="https://tronscan.org/#/blockchain/contracts"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-primary"
              >
                Open TronScan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Results Section */}
      <section className="mx-auto mt-8 max-w-5xl">
        <AnimatePresence mode="wait">
          {/* Loading State */}
          {load.state === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Main loading card */}
              <div className="rounded-sm border border-border bg-card p-8">
                <div className="flex flex-col items-center justify-center gap-5">
                  {/* Simple spinner */}
                  <div className="h-10 w-10 spinner" />

                  {/* Loading text */}
                  <div className="text-center">
                    <p className="text-base font-medium text-foreground">Analyzing address</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Running blacklist checks and risk analysis
                    </p>
                  </div>
                </div>
              </div>

              {/* Method cards - compact */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-4 rounded-sm border border-border bg-card px-5 py-4">
                  <div className="h-6 w-6 spinner border-t-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">TronScan Index</p>
                    <p className="text-xs text-muted-foreground">Querying indexed data...</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-sm border border-border bg-card px-5 py-4">
                  <div className="h-6 w-6 spinner border-t-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">On-chain Read</p>
                    <p className="text-xs text-muted-foreground">Reading smart contract...</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {load.state === "error" && (
            <motion.div
              key="error"
              {...fadeInUp}
              transition={{ duration: 0.15 }}
              className="rounded-sm bg-warning p-5"
            >
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-black/10">
                  <AlertTriangle className="h-5 w-5 text-warning-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-warning-foreground">
                    Couldn&apos;t complete the check
                  </h3>
                  <p className="mt-1 text-sm text-warning-foreground/80">{load.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-warning-foreground/30 bg-transparent text-warning-foreground hover:bg-warning-foreground/10"
                      onClick={() => runCheck(normalizedAddress)}
                      disabled={!isValid}
                    >
                      Retry
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-warning-foreground hover:bg-warning-foreground/10"
                      onClick={() => setLoad({ state: "idle" })}
                    >
                      Clear
                    </Button>
                  </div>
                  {load.details && (
                    <details className="mt-4 rounded-sm border border-warning-foreground/20 bg-black/5">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-warning-foreground">
                        Technical details
                      </summary>
                      <pre className="overflow-auto border-t border-warning-foreground/20 px-3 py-2 font-mono text-xs text-warning-foreground/80">
                        {load.details}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Success State */}
          {load.state === "success" && (
            <motion.div
              key="success"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              {/* Status Banner */}
              <StatusBanner data={load.data} />

              {/* USDT Balance - Prominent Display */}
              {load.data.balance?.ok && (
                <motion.div {...fadeInUp} transition={{ duration: 0.15 }}>
                  <Card className="overflow-hidden accent-bar accent-bar-success">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-success text-white">
                            <span className="text-xl font-bold">₮</span>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">USDT Balance</div>
                            <div className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                              {Number(load.data.balance.usdt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">TRC-20</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {clerkEnabled && (
                <SignedIn>
                  <SaveReportControl report={load.data} />
                </SignedIn>
              )}

              {/* Summary Card */}
              <motion.div {...fadeInUp} transition={{ duration: 0.15 }}>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {consensus?.status === "blacklisted" && (
                        <Badge variant="danger">
                          Blacklisted
                        </Badge>
                      )}
                      {consensus?.status === "not_blacklisted" && (
                        <Badge variant="success">
                          Not blacklisted
                        </Badge>
                      )}
                      {consensus?.status === "inconclusive" && (
                        <Badge variant="warning">
                          Inconclusive
                        </Badge>
                      )}
                      {load.data.consensus.match ? (
                        <Badge variant="secondary" className="text-success">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Both methods agree
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-warning">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Partial / mismatch
                        </Badge>
                      )}

                      {typeof load.data.risk?.score === "number" && (
                        <Badge
                          variant={
                            load.data.risk.tier === "low"
                              ? "success"
                              : load.data.risk.tier === "guarded"
                                ? "secondary"
                                : load.data.risk.tier === "elevated"
                                  ? "warning"
                                  : "danger"
                          }
                        >
                          Risk {load.data.risk.score}/100
                        </Badge>
                      )}

                      {typeof load.data.risk?.confidence === "number" && (
                        <Badge variant="outline">
                          Confidence {Math.round(load.data.risk.confidence)}/100
                        </Badge>
                      )}

                      {load.data.checks?.entity?.ok && (
                        <Badge variant="outline">
                          {load.data.checks.entity.kind === "exchange" ? "Exchange" : load.data.checks.entity.kind === "particular" ? "Particular" : "Unlabeled"}
                        </Badge>
                      )}

                      {load.data.checks?.sanctions?.ok && (
                        <Badge variant={load.data.checks.sanctions.matched ? "danger" : "success"}>
                          {load.data.checks.sanctions.matched ? "OFAC match" : "No OFAC match"}
                        </Badge>
                      )}

                      {!load.data.checks?.sanctions?.ok && (
                        <Badge variant="warning">
                          Sanctions screen unavailable
                        </Badge>
                      )}

                      {load.data.access?.authenticated === false && (
                        <Badge variant="outline">
                          Free (limited)
                        </Badge>
                      )}
                      <Badge variant="outline" className="ml-auto">
                        {formatDateTime(load.data.timestamps.checkedAtIso)}
                      </Badge>
                    </div>

                    <Separator className="my-4" />

                    <DataRow
                      label="Checked Address"
                      value={load.data.address}
                      copyValue={load.data.address}
                      href={tronscanAddressUrl(load.data.address)}
                      mono
                    />

                    {/* Desktop 2-column grid for entity and volume */}
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {load.data.checks?.entity?.ok && (
                      <div className="rounded-sm border border-border bg-muted/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Entity tag (best-effort)
                          </div>
                          <Badge variant="outline">
                            Confidence {Math.round(load.data.checks.entity.confidence * 100)}%
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-foreground">{load.data.checks.entity.label}</div>
                        {load.data.checks.entity.subjectTag?.publicTag && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            TronScan tag:{" "}
                            <a
                              href={tronscanAddressUrl(load.data.address)}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-border underline-offset-4 hover:decoration-primary"
                            >
                              {load.data.checks.entity.subjectTag.publicTag}
                            </a>
                          </div>
                        )}
                        {load.data.checks.entity.outbound && (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Observed outbound: {load.data.checks.entity.outbound.totalOutboundAmount} USDT · To exchange-tagged:{" "}
                            {Math.round(load.data.checks.entity.outbound.exchangeTaggedShare * 100)}%
                          </div>
                        )}
                        {load.data.checks.entity.outbound && load.data.checks.entity.outbound.top.some((t) => t.isExchangeTagged) && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Top outbound exchange destinations
                            </div>
                            {load.data.checks.entity.outbound.top
                              .filter((t) => t.isExchangeTagged)
                              .slice(0, 3)
                              .map((t) => (
                                <div key={t.address} className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-background px-3 py-2">
                                  <div className="min-w-0">
                                    <a
                                      href={tronscanAddressUrl(t.address)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-[13px] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                                    >
                                      {truncateAddress(t.address)}
                                    </a>
                                    {t.publicTag && <div className="mt-0.5 text-xs text-muted-foreground">{t.publicTag}</div>}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {t.outboundAmount} USDT ({t.outboundTxCount})
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                        {load.data.checks.entity.reasons?.length > 0 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            {load.data.checks.entity.reasons.join(" ")}
                          </div>
                        )}
                      </div>
                    )}

                    {load.data.checks?.volume && load.data.checks.volume.ok && (
                      <div className="rounded-sm border border-border bg-muted/50 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          USDT volume (best-effort)
                        </div>
                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-sm bg-background p-3">
                            <div className="text-xs font-medium text-muted-foreground">7 days</div>
                            <div className="mt-1 text-sm text-foreground">
                              In: {formatVolumeAmount(load.data.checks.volume.stats.windows.d7.inbound.amount)} ({load.data.checks.volume.stats.windows.d7.inbound.txCount})
                            </div>
                            <div className="text-sm text-foreground">
                              Out: {formatVolumeAmount(load.data.checks.volume.stats.windows.d7.outbound.amount)} ({load.data.checks.volume.stats.windows.d7.outbound.txCount})
                            </div>
                          </div>
                          <div className="rounded-sm bg-background p-3">
                            <div className="text-xs font-medium text-muted-foreground">30 days</div>
                            <div className="mt-1 text-sm text-foreground">
                              In: {formatVolumeAmount(load.data.checks.volume.stats.windows.d30.inbound.amount)} ({load.data.checks.volume.stats.windows.d30.inbound.txCount})
                            </div>
                            <div className="text-sm text-foreground">
                              Out: {formatVolumeAmount(load.data.checks.volume.stats.windows.d30.outbound.amount)} ({load.data.checks.volume.stats.windows.d30.outbound.txCount})
                            </div>
                          </div>
                          <div className="rounded-sm bg-background p-3">
                            <div className="text-xs font-medium text-muted-foreground">90 days</div>
                            <div className="mt-1 text-sm text-foreground">
                              In: {formatVolumeAmount(load.data.checks.volume.stats.windows.d90.inbound.amount)} ({load.data.checks.volume.stats.windows.d90.inbound.txCount})
                            </div>
                            <div className="text-sm text-foreground">
                              Out: {formatVolumeAmount(load.data.checks.volume.stats.windows.d90.outbound.amount)} ({load.data.checks.volume.stats.windows.d90.outbound.txCount})
                            </div>
                          </div>
                        </div>
                        {(load.data.checks.volume.stats.largestInbound || load.data.checks.volume.stats.largestOutbound) && (
                          <div className="mt-3 space-y-2">
                            {load.data.checks.volume.stats.largestInbound && (
                              <DataRow
                                label="Largest inbound"
                                value={`${load.data.checks.volume.stats.largestInbound.amount} USDT`}
                                href={tronscanTxUrl(load.data.checks.volume.stats.largestInbound.txHash)}
                              />
                            )}
                            {load.data.checks.volume.stats.largestOutbound && (
                              <DataRow
                                label="Largest outbound"
                                value={`${load.data.checks.volume.stats.largestOutbound.amount} USDT`}
                                href={tronscanTxUrl(load.data.checks.volume.stats.largestOutbound.txHash)}
                              />
                            )}
                          </div>
                        )}
                        {load.data.checks.volume.notices?.length > 0 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            {load.data.checks.volume.notices.join(" ")}
                          </div>
                        )}
                      </div>
                    )}

                    {load.data.checks?.volume &&
                      typeof load.data.checks.volume === "object" &&
                      "ok" in load.data.checks.volume &&
                      (load.data.checks.volume as { ok: boolean }).ok === false &&
                      (load.data.checks.volume as { locked?: boolean }).locked && (
                        <div className="rounded-sm border border-border bg-muted/50 p-4 text-sm text-muted-foreground lg:col-span-2">
                          Volume context is locked. Sign in to unlock additional AML checks.
                        </div>
                      )}
                    </div>
                    {/* End of entity/volume 2-column grid */}

                    {/* Desktop 2-column grid for exposure and tracing */}
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {load.data.checks?.exposure1hop && load.data.checks.exposure1hop.ok && (
                      <div className="rounded-sm border border-border bg-muted/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Direct exposure (1-hop, inbound)
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={load.data.checks.exposure1hop.summary.flaggedCounterpartyCount > 0 ? "warning" : "success"}>
                              Flagged: {load.data.checks.exposure1hop.summary.flaggedCounterpartyCount}/10
                            </Badge>
                            <Badge variant="outline">
                              Window: {load.data.checks.exposure1hop.window.lookbackDays}d
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-muted-foreground">
                          Observed inbound: {load.data.checks.exposure1hop.inbound.totalInboundAmount} USDT ({load.data.checks.exposure1hop.inbound.totalInboundTxCount} tx)
                        </div>

                        <div className="mt-3 space-y-2">
                          {load.data.checks.exposure1hop.counterparties.slice(0, 10).map((c) => (
                            <div key={c.address} className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-background px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <a
                                  href={tronscanAddressUrl(c.address)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate font-mono text-[13px] text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                                >
                                  {truncateAddress(c.address)}
                                </a>
                                {c.flags.usdtBlacklisted && <Badge variant="danger">USDT blacklisted</Badge>}
                                {c.flags.sanctioned && <Badge variant="danger">OFAC</Badge>}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{c.inboundAmount} USDT</span>
                                <span className="text-muted-foreground/60">·</span>
                                <span>{c.inboundTxCount} tx</span>
                                {c.sampleTxHash && (
                                  <>
                                    <span className="text-muted-foreground/60">·</span>
                                    <a
                                      href={tronscanTxUrl(c.sampleTxHash)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:decoration-primary"
                                    >
                                      tx
                                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {load.data.checks.exposure1hop.notices?.length > 0 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            {load.data.checks.exposure1hop.notices.join(" ")}
                          </div>
                        )}
                      </div>
                    )}

                    {load.data.checks?.exposure1hop &&
                      typeof load.data.checks.exposure1hop === "object" &&
                      "ok" in load.data.checks.exposure1hop &&
                      (load.data.checks.exposure1hop as { ok: boolean }).ok === false && (
                        <div className="rounded-sm border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                          Exposure check unavailable: {(load.data.checks.exposure1hop as { error: string }).error}
                        </div>
                      )}

                    {load.data.checks?.tracing2hop &&
                      typeof load.data.checks.tracing2hop === "object" &&
                      "ok" in load.data.checks.tracing2hop &&
                      (load.data.checks.tracing2hop as { ok: boolean }).ok === false &&
                      (load.data.checks.tracing2hop as { locked?: boolean }).locked && (
                        <div className="rounded-sm border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                          2-hop tracing is locked. Sign in to unlock advanced AML checks.
                        </div>
                      )}

                    {load.data.checks?.tracing2hop && load.data.checks.tracing2hop.ok && (
                      <div className="rounded-sm border border-border bg-muted/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            2-hop tracing (sampled)
                          </div>
                          <Badge variant={load.data.checks.tracing2hop.anyFlagged ? "warning" : "success"}>
                            {load.data.checks.tracing2hop.anyFlagged ? "Flagged proximity detected" : "No flagged proximity detected"}
                          </Badge>
                        </div>

                        {load.data.checks.tracing2hop.anyFlagged && (
                          <div className="mt-3 space-y-2">
                            {load.data.checks.tracing2hop.paths
                              .filter((p) => p.sources.length > 0)
                              .slice(0, 5)
                              .map((p) => (
                                <div key={p.viaCounterparty} className="rounded-sm bg-background px-3 py-2">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    via{" "}
                                    <a
                                      href={tronscanAddressUrl(p.viaCounterparty)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono underline decoration-border underline-offset-4 hover:decoration-primary"
                                    >
                                      {truncateAddress(p.viaCounterparty)}
                                    </a>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {p.sources.slice(0, 5).map((s) => (
                                      <Badge key={s.address} variant="outline">
                                        {truncateAddress(s.address)}{s.flags.usdtBlacklisted ? " · USDT" : ""}{s.flags.sanctioned ? " · OFAC" : ""}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        {load.data.checks.tracing2hop.notices?.length > 0 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            {load.data.checks.tracing2hop.notices.join(" ")}
                          </div>
                        )}
                      </div>
                    )}

                    {load.data.checks?.heuristics &&
                      typeof load.data.checks.heuristics === "object" &&
                      "ok" in load.data.checks.heuristics &&
                      (load.data.checks.heuristics as { ok: boolean }).ok === false &&
                      (load.data.checks.heuristics as { locked?: boolean }).locked && (
                        <div className="rounded-sm border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                          Flow heuristics are locked. Sign in to unlock advanced AML checks.
                        </div>
                      )}

                    {load.data.checks?.heuristics && load.data.checks.heuristics.ok && (
                      <div className="rounded-sm border border-border bg-muted/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Flow heuristics (best-effort)
                          </div>
                          <Badge variant={load.data.checks.heuristics.findings.length ? "warning" : "success"}>
                            Findings: {load.data.checks.heuristics.findings.length}
                          </Badge>
                        </div>
                        {load.data.checks.heuristics.findings.length > 0 ? (
                          <ul className="mt-3 space-y-2 text-sm">
                            {load.data.checks.heuristics.findings.map((f, i) => (
                              <li key={`${f.key}-${i}`} className="flex items-start justify-between gap-2 rounded-sm bg-background px-3 py-2">
                                <span className="text-foreground">{f.label}</span>
                                <Badge variant={f.severity === "danger" ? "danger" : f.severity === "warning" ? "warning" : "secondary"}>
                                  {f.severity}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-3 text-sm text-muted-foreground">No suspicious flow patterns detected in the sampled window.</div>
                        )}
                      </div>
                    )}
                    </div>
                    {/* End of exposure/tracing/heuristics 2-column grid */}

                    {load.data.notices?.length > 0 && (
                      <div className="mt-4 rounded-sm bg-muted/50 p-4">
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {load.data.notices.map((n, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Scam Warning (only for blacklisted) */}
              {load.data.consensus.status === "blacklisted" && <ScamWarningAlert />}

              {/* Evidence Cards */}
              <div>
                <SectionHeader>Verification Details</SectionHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MethodCard
                    title="TronScan Index"
                    description="Indexed blacklist data"
                    result={load.data.checks.tronscan}
                  />
                  <MethodCard
                    title="On-chain Read"
                    description="Direct contract query"
                    result={load.data.checks.onchain}
                  />
                </div>
              </div>

              {/* Guidance / FAQ */}
              <motion.div {...fadeInUp} transition={{ duration: 0.15 }}>
                <SectionHeader>Learn More</SectionHeader>
                <Tabs defaultValue="guidance" className="mt-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="guidance">
                      Guidance
                    </TabsTrigger>
                    <TabsTrigger value="faq">
                      FAQ
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="guidance" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>What should I do next?</CardTitle>
                        <CardDescription>Practical steps without panic</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-3 text-sm text-muted-foreground">
                          <li className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary text-[10px] font-bold text-primary-foreground">
                              1
                            </div>
                            <span>
                              If this is an exchange address, contact the exchange&apos;s official support.
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary text-[10px] font-bold text-primary-foreground">
                              2
                            </div>
                            <span>
                              Only the issuer (Tether) can address blacklist decisions.
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary text-[10px] font-bold text-primary-foreground">
                              3
                            </div>
                            <span>
                              Don&apos;t pay &quot;recovery&quot; services. Never share seed phrases.
                            </span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="faq" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Frequently Asked Questions</CardTitle>
                        <CardDescription>Quick answers to common questions</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="meaning">
                            <AccordionTrigger className="py-3 text-sm">
                              What does &quot;blacklisted&quot; mean?
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 text-sm">
                              The USDT smart contract can restrict addresses. If blacklisted, USDT transfers
                              from that address will likely revert on-chain.
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="moves">
                            <AccordionTrigger className="py-3 text-sm">
                              What can and can&apos;t move?
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 text-sm">
                              This check only applies to USDT (TRC20). Other tokens or TRX may still be
                              transferable, depending on their contract rules.
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="privacy" className="border-b-0">
                            <AccordionTrigger className="py-3 text-sm">
                              Do you store my address?
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 text-sm">
                              No. This site doesn&apos;t log or store addresses by default, and it has no
                              analytics.
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer disclaimer */}
      <div className="mx-auto mt-12 max-w-2xl border-t border-border pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Informational only; not legal advice. Never share seed phrases or private keys.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Created by{" "}
          <a
            className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary"
            href="https://www.instagram.com/chikocryptocr/"
            target="_blank"
            rel="noreferrer"
          >
            Chikocorp
          </a>
        </p>
      </div>
    </div>
  );
}
