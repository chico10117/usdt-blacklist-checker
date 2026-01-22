"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
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

import { ThemeToggle } from "@/components/theme-toggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
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

const LOGGING_PREF_KEY = "usdt_blacklisted_web:loggingEnabled";

function readLocalLoggingPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOGGING_PREF_KEY) === "true";
  } catch {
    return false;
  }
}

function writeLocalLoggingPref(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOGGING_PREF_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
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
      className={`${sizeClasses} inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95`}
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
        <Check className={`${iconClasses} text-emerald-600 dark:text-emerald-400`} />
      ) : (
        <Copy className={iconClasses} />
      )}
    </button>
  );
}

function TrustBadge({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-4 flex items-center gap-2 ${className ?? ""}`}>
      <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
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
    <div className="group flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${textClasses} inline-flex items-center gap-1.5 break-all text-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:decoration-primary`}
          >
            {displayValue}
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
        ) : (
          <div className={`${textClasses} break-all text-foreground`}>{displayValue}</div>
        )}
      </div>
      {copyValue && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
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
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 p-5 dark:border-red-500/30 dark:from-red-950/50 dark:to-red-900/20"
      >
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/25">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
              Blacklisted for USDT on TRON
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-red-800/80 dark:text-red-200/80">
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
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 dark:border-emerald-500/30 dark:from-emerald-950/50 dark:to-emerald-900/20"
      >
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
              Not Blacklisted
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
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
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 dark:border-amber-500/30 dark:from-amber-950/50 dark:to-amber-900/20"
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/25">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            Inconclusive
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-800/80 dark:text-amber-200/80">
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
    ? { label: "Unavailable", variant: "warning" as BadgeVariant, dotClass: "bg-amber-500" }
    : blacklisted
      ? { label: "Blacklisted", variant: "danger" as BadgeVariant, dotClass: "bg-red-500" }
      : { label: "Clear", variant: "success" as BadgeVariant, dotClass: "bg-emerald-500" };

  return (
    <motion.div {...fadeInUp} transition={{ duration: 0.25 }}>
      <Card className="h-full overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusConfig.dotClass}`} />
              <Badge variant={statusConfig.variant} className="text-[11px]">
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          {!ok ? (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
              {result.error}
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border/50">
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
      transition={{ duration: 0.25, delay: 0.1 }}
      className="rounded-xl border border-red-200/60 bg-red-50/50 p-4 dark:border-red-500/20 dark:bg-red-950/30"
    >
      <div className="flex gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div>
          <p className="text-sm font-medium text-red-900 dark:text-red-100">Scam Warning</p>
          <p className="mt-0.5 text-sm text-red-800/80 dark:text-red-200/70">
            No legitimate service can &quot;unblacklist&quot; an address for a fee. Never share your seed phrase.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Main Component
 * ──────────────────────────────────────────────────────────────────────────── */

export function BlacklistChecker() {
  const m = getMessages("en");
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const [address, setAddress] = React.useState("");
  const [validation, setValidation] = React.useState<ReturnType<typeof validateTronAddress> | null>(null);
  const [load, setLoad] = React.useState<LoadState>({ state: "idle" });
  const [loggingEnabled, setLoggingEnabled] = React.useState(false);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      if (!address.trim()) return setValidation(null);
      setValidation(validateTronAddress(address));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [address]);

  React.useEffect(() => {
    setLoggingEnabled(readLocalLoggingPref());
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Subtle gradient orb decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-1/2 h-[80%] w-[80%] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/5 via-transparent to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 mx-auto grid w-full max-w-4xl grid-cols-3 items-center px-4 py-5 sm:px-6 sm:py-6">
        {/* Left: Logo */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <Image
            src="/logo1.png"
            alt="Chikocorp TRON Security"
            width={100}
            height={100}
            className="h-20 w-20 object-contain rounded-xl"
            priority
          />
          <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        {/* Center: Text */}
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">Tron wallet blacklist checker</div>
          <div className="text-xs text-muted-foreground">TRON Security by Chikocorp</div>
        </div>
        {/* Right: Theme Toggle */}
        <div className="flex justify-end gap-3">
          {clerkEnabled && (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button type="button" variant="outline" size="sm">
                    Sign in
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        {clerkEnabled && (
          <SignedIn>
            <SignedInAutoRerun
              enabled={clerkEnabled}
              normalizedAddress={normalizedAddress}
              shouldRerun={isValid && shouldAutoRerunAfterSignIn}
              onRerun={(addr) => {
                toast.message("Signed in — loading enhanced checks…");
                runCheck(addr);
              }}
            />
          </SignedIn>
        )}

        {/* Hero Section */}
        <section className="mx-auto max-w-2xl pt-4 text-center sm:pt-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl lg:text-5xl">
              {m.title}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {m.subtitle}
            </p>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            <TrustBadge icon={ShieldCheck}>{m.noKeysBadge}</TrustBadge>
            <TrustBadge icon={EyeOff}>{m.noTrackingBadge}</TrustBadge>
          </motion.div>
        </section>

        {/* Input Card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mx-auto mt-8 max-w-2xl sm:mt-10"
        >
          <Card className="overflow-hidden border-border/60 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
            <CardHeader className="space-y-2 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Check Any TRON Address</CardTitle>
                  <CardDescription className="mt-0.5 leading-relaxed">
                    Only paste a public address. Never share seed phrases or private keys.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Input Group */}
              <div className="space-y-2">
                <label htmlFor="tron-address" className="text-sm font-medium text-foreground">
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
                      className="h-12 border-border/60 bg-muted/30 pr-10 font-mono text-[15px] shadow-inner transition-all placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background"
                      aria-invalid={address.trim().length > 0 && !isValid}
                    />
                    {address && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                    className="h-9 min-w-[100px] gap-2 shadow-md shadow-primary/20"
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
                    <p className="text-sm text-red-600 dark:text-red-400">{validation.error}</p>
                  ) : validation && validation.ok ? (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
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

              <Separator className="bg-border/60" />

              {/* Contract Reference */}
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">USDT Contract:</span>
                  <a
                    href={tronscanContractUrl(USDT_TRC20_CONTRACT)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-primary"
                  >
                    {truncateAddress(USDT_TRC20_CONTRACT, 6, 4)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <InlineCopyButton value={USDT_TRC20_CONTRACT} />
                </div>
                <a
                  href="https://tronscan.org/#/blockchain/contracts"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-primary"
                >
                  Open TronScan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {clerkEnabled && (
          <SignedIn>
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18 }}
              className="mx-auto mt-4 max-w-2xl"
            >
              <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Account</CardTitle>
                  <CardDescription>
                    Configure privacy defaults. Saving reports is not enabled yet (DB/credits work is next).
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Opt-in: save screening history</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      This currently stores only a local preference. No server-side address logging is performed yet.
                    </div>
                  </div>
                  <Switch
                    checked={loggingEnabled}
                    onCheckedChange={(v) => {
                      setLoggingEnabled(v);
                      writeLocalLoggingPref(v);
                      toast.message(v ? "Logging preference enabled (local only)" : "Logging preference disabled");
                    }}
                    aria-label="Enable saving screening history"
                  />
                </CardContent>
              </Card>
            </motion.section>
          </SignedIn>
        )}

        {/* Results Section */}
        <section className="mx-auto mt-8 max-w-2xl">
          <AnimatePresence mode="wait">
            {/* Loading State */}
            {load.state === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <Skeleton className="h-24 w-full rounded-2xl" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-56 w-full rounded-2xl" />
                  <Skeleton className="h-56 w-full rounded-2xl" />
                </div>
              </motion.div>
            )}

            {/* Error State */}
            {load.state === "error" && (
              <motion.div
                key="error"
                {...fadeInUp}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 dark:border-amber-500/30 dark:from-amber-950/50 dark:to-amber-900/20"
              >
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                      Couldn&apos;t complete the check
                    </h3>
                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">{load.message}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => runCheck(normalizedAddress)}
                        disabled={!isValid}
                      >
                        Retry
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLoad({ state: "idle" })}
                      >
                        Clear
                      </Button>
                    </div>
                    {load.details && (
                      <details className="mt-4 rounded-lg border border-amber-200/60 bg-white/50 dark:border-amber-500/20 dark:bg-black/20">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                          Technical details
                        </summary>
                        <pre className="overflow-auto border-t border-amber-200/60 px-3 py-2 font-mono text-xs text-amber-700/80 dark:border-amber-500/20 dark:text-amber-300/80">
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

                {/* Summary Card */}
                <motion.div {...fadeInUp} transition={{ duration: 0.25 }}>
                  <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {consensus?.status === "blacklisted" && (
                          <Badge variant="danger" className="gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            Blacklisted
                          </Badge>
                        )}
                        {consensus?.status === "not_blacklisted" && (
                          <Badge variant="success" className="gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            Not blacklisted
                          </Badge>
                        )}
                        {consensus?.status === "inconclusive" && (
                          <Badge variant="warning" className="gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            Inconclusive
                          </Badge>
                        )}
                        {load.data.consensus.match ? (
                          <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Both methods agree
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
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
                            className="gap-1"
                          >
                            Risk {load.data.risk.score}/100
                          </Badge>
                        )}

                        {typeof load.data.risk?.confidence === "number" && (
                          <Badge variant="outline" className="gap-1">
                            Confidence {Math.round(load.data.risk.confidence)}/100
                          </Badge>
                        )}

                        {load.data.checks?.entity?.ok && (
                          <Badge
                            variant={
                              load.data.checks.entity.kind === "exchange"
                                ? "secondary"
                                : load.data.checks.entity.kind === "particular"
                                  ? "outline"
                                  : "outline"
                            }
                            className="gap-1"
                          >
                            {load.data.checks.entity.kind === "exchange" ? "Exchange" : load.data.checks.entity.kind === "particular" ? "Particular" : "Unlabeled"}
                          </Badge>
                        )}

                        {load.data.checks?.sanctions?.ok && (
                          <Badge
                            variant={load.data.checks.sanctions.matched ? "danger" : "success"}
                            className="gap-1"
                          >
                            {load.data.checks.sanctions.matched ? "OFAC match" : "No OFAC match"}
                          </Badge>
                        )}

                        {!load.data.checks?.sanctions?.ok && (
                          <Badge variant="warning" className="gap-1">
                            Sanctions screen unavailable
                          </Badge>
                        )}

                        {load.data.access?.authenticated === false && (
                          <Badge variant="outline" className="gap-1">
                            Free (limited)
                          </Badge>
                        )}
                        <Badge variant="outline" className="ml-auto">
                          {formatDateTime(load.data.timestamps.checkedAtIso)}
                        </Badge>
                      </div>

                      <Separator className="my-4 bg-border/60" />

                      <DataRow
                        label="Checked Address"
                        value={load.data.address}
                        copyValue={load.data.address}
                        href={tronscanAddressUrl(load.data.address)}
                        mono
                      />

                      {load.data.checks?.entity?.ok && (
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                                className="underline decoration-muted-foreground/30 underline-offset-4 hover:decoration-primary"
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
                              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Top outbound exchange destinations
                              </div>
                              {load.data.checks.entity.outbound.top
                                .filter((t) => t.isExchangeTagged)
                                .slice(0, 3)
                                .map((t) => (
                                  <div key={t.address} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2">
                                    <div className="min-w-0">
                                      <a
                                        href={tronscanAddressUrl(t.address)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-mono text-[13px] text-foreground underline decoration-muted-foreground/30 underline-offset-4 hover:decoration-primary"
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
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
                          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            USDT volume (best-effort)
                          </div>
                          <div className="mt-2 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg bg-background/60 p-3">
                              <div className="text-xs font-medium text-muted-foreground">7 days</div>
                              <div className="mt-1 text-sm text-foreground">
                                In: {load.data.checks.volume.stats.windows.d7.inbound.amount} ({load.data.checks.volume.stats.windows.d7.inbound.txCount})
                              </div>
                              <div className="text-sm text-foreground">
                                Out: {load.data.checks.volume.stats.windows.d7.outbound.amount} ({load.data.checks.volume.stats.windows.d7.outbound.txCount})
                              </div>
                            </div>
                            <div className="rounded-lg bg-background/60 p-3">
                              <div className="text-xs font-medium text-muted-foreground">30 days</div>
                              <div className="mt-1 text-sm text-foreground">
                                In: {load.data.checks.volume.stats.windows.d30.inbound.amount} ({load.data.checks.volume.stats.windows.d30.inbound.txCount})
                              </div>
                              <div className="text-sm text-foreground">
                                Out: {load.data.checks.volume.stats.windows.d30.outbound.amount} ({load.data.checks.volume.stats.windows.d30.outbound.txCount})
                              </div>
                            </div>
                            <div className="rounded-lg bg-background/60 p-3">
                              <div className="text-xs font-medium text-muted-foreground">90 days</div>
                              <div className="mt-1 text-sm text-foreground">
                                In: {load.data.checks.volume.stats.windows.d90.inbound.amount} ({load.data.checks.volume.stats.windows.d90.inbound.txCount})
                              </div>
                              <div className="text-sm text-foreground">
                                Out: {load.data.checks.volume.stats.windows.d90.outbound.amount} ({load.data.checks.volume.stats.windows.d90.outbound.txCount})
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
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                            Volume context is locked. Sign in to unlock additional AML checks.
                          </div>
                        )}

                      {load.data.checks?.exposure1hop && load.data.checks.exposure1hop.ok && (
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                              <div key={c.address} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <a
                                    href={tronscanAddressUrl(c.address)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate font-mono text-[13px] text-foreground underline decoration-muted-foreground/30 underline-offset-4 hover:decoration-primary"
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
                                        className="inline-flex items-center gap-1 underline decoration-muted-foreground/30 underline-offset-4 hover:decoration-primary"
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
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                            Exposure check unavailable: {(load.data.checks.exposure1hop as { error: string }).error}
                          </div>
                        )}

                      {load.data.checks?.tracing2hop &&
                        typeof load.data.checks.tracing2hop === "object" &&
                        "ok" in load.data.checks.tracing2hop &&
                        (load.data.checks.tracing2hop as { ok: boolean }).ok === false &&
                        (load.data.checks.tracing2hop as { locked?: boolean }).locked && (
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                            2-hop tracing is locked. Sign in to unlock advanced AML checks.
                          </div>
                        )}

                      {load.data.checks?.tracing2hop && load.data.checks.tracing2hop.ok && (
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                                  <div key={p.viaCounterparty} className="rounded-lg bg-background/60 px-3 py-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                      via{" "}
                                      <a
                                        href={tronscanAddressUrl(p.viaCounterparty)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-mono underline decoration-muted-foreground/30 underline-offset-4 hover:decoration-primary"
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
                          <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                            Flow heuristics are locked. Sign in to unlock advanced AML checks.
                          </div>
                        )}

                      {load.data.checks?.heuristics && load.data.checks.heuristics.ok && (
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Flow heuristics (best-effort)
                            </div>
                            <Badge variant={load.data.checks.heuristics.findings.length ? "warning" : "success"}>
                              Findings: {load.data.checks.heuristics.findings.length}
                            </Badge>
                          </div>
                          {load.data.checks.heuristics.findings.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-sm">
                              {load.data.checks.heuristics.findings.map((f, i) => (
                                <li key={`${f.key}-${i}`} className="flex items-start justify-between gap-2 rounded-lg bg-background/60 px-3 py-2">
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

                      {load.data.notices?.length > 0 && (
                        <div className="mt-4 rounded-lg bg-muted/50 p-3">
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
                <motion.div {...fadeInUp} transition={{ duration: 0.25 }}>
                  <SectionHeader>Learn More</SectionHeader>
                  <Tabs defaultValue="guidance" className="mt-4">
                    <TabsList className="h-10 w-full justify-start bg-muted/50 p-1">
                      <TabsTrigger value="guidance" className="flex-1 sm:flex-none">
                        Guidance
                      </TabsTrigger>
                      <TabsTrigger value="faq" className="flex-1 sm:flex-none">
                        FAQ
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="guidance" className="mt-4">
                      <Card className="border-border/60 bg-card/80">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">What should I do next?</CardTitle>
                          <CardDescription>Practical steps without panic</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-start gap-3">
                              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                1
                              </div>
                              <span>
                                If this is an exchange address, contact the exchange&apos;s official support.
                              </span>
                            </li>
                            <li className="flex items-start gap-3">
                              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                2
                              </div>
                              <span>
                                Only the issuer (Tether) can address blacklist decisions.
                              </span>
                            </li>
                            <li className="flex items-start gap-3">
                              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
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
                      <Card className="border-border/60 bg-card/80">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
                          <CardDescription>Quick answers to common questions</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="meaning" className="border-border/60">
                              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                                What does &quot;blacklisted&quot; mean?
                              </AccordionTrigger>
                              <AccordionContent className="pb-4 text-sm text-muted-foreground">
                                The USDT smart contract can restrict addresses. If blacklisted, USDT transfers
                                from that address will likely revert on-chain.
                              </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="moves" className="border-border/60">
                              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                                What can and can&apos;t move?
                              </AccordionTrigger>
                              <AccordionContent className="pb-4 text-sm text-muted-foreground">
                                This check only applies to USDT (TRC20). Other tokens or TRX may still be
                                transferable, depending on their contract rules.
                              </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="privacy" className="border-b-0 border-border/60">
                              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                                Do you store my address?
                              </AccordionTrigger>
                              <AccordionContent className="pb-4 text-sm text-muted-foreground">
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

        {/* Footer */}
        <footer className="mx-auto mt-16 max-w-2xl border-t border-border/60 pt-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center">
              <Image
                src="/logo1.png"
                alt="Chikocorp"
                width={48}
                height={48}
                className="h-12 w-12 object-contain opacity-60"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Informational only; not legal advice. Always verify with official sources.
              </p>
              <p className="text-sm font-medium text-foreground">
                Never share seed phrases or private keys.
              </p>
            </div>
            <Separator className="my-2 w-16 bg-border/60" />
            <p className="text-sm text-muted-foreground">
              Created by{" "}
              <a
                className="font-medium text-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:decoration-primary"
                href="https://www.instagram.com/chikocryptocr/"
                target="_blank"
                rel="noreferrer"
              >
                Chikocorp
              </a>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
