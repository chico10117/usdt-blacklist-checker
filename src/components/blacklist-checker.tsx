"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USDT_TRC20_CONTRACT } from "@/lib/tron";
import { getMessages } from "@/lib/i18n";
import { validateTronAddress } from "@/lib/validators";

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
  checks: {
    tronscan: CheckResult;
    onchain: CheckResult;
  };
  consensus: {
    status: "blacklisted" | "not_blacklisted" | "inconclusive";
    match: boolean;
  };
  timestamps: { checkedAtIso: string };
  notices: string[];
};

type LoadState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; data: ApiResponse }
  | { state: "error"; message: string; status?: number; details?: string };

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

function StatusBanner({ data }: { data: ApiResponse }) {
  const status = data.consensus.status;

  if (status === "blacklisted") {
    return (
      <Alert variant="danger">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Blacklisted for USDT on TRON</AlertTitle>
        <AlertDescription>
          This address appears to be blacklisted for USDT (TRC20). USDT transfers from this address will likely fail.
        </AlertDescription>
      </Alert>
    );
  }
  if (status === "not_blacklisted") {
    return (
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Not blacklisted (at time of check)</AlertTitle>
        <AlertDescription>No blacklist record found for USDT on TRON at the time of check.</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Inconclusive</AlertTitle>
      <AlertDescription>Could not confirm via both methods due to network or API issues. Try again.</AlertDescription>
    </Alert>
  );
}

function ResultRow({ label, value, copyValue, href }: { label: string; value: string; copyValue?: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {href ? (
          <a className="break-all text-sm underline underline-offset-4 hover:opacity-80" href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          <div className="break-all text-sm">{value}</div>
        )}
      </div>
      {copyValue ? <CopyButton value={copyValue} /> : null}
    </div>
  );
}

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
  const badgeVariant: BadgeVariant = !ok ? "warning" : blacklisted ? "danger" : "success";
  const badgeText = !ok ? "Unavailable" : blacklisted ? "Blacklisted" : "Not blacklisted";
  const evidence = ok ? result.evidence : undefined;

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ok ? (
          <div className="text-sm text-muted-foreground">{result.error}</div>
        ) : (
          <>
            <ResultRow
              label="Contract"
              value={evidence?.contractAddress ?? USDT_TRC20_CONTRACT}
              copyValue={evidence?.contractAddress ?? USDT_TRC20_CONTRACT}
              href={tronscanContractUrl(evidence?.contractAddress ?? USDT_TRC20_CONTRACT)}
            />
            {"txHash" in (evidence ?? {}) && evidence?.txHash ? (
              <ResultRow
                label="Blacklist tx"
                value={evidence.txHash}
                copyValue={evidence.txHash}
                href={tronscanTxUrl(evidence.txHash)}
              />
            ) : null}
            {"timestampIso" in (evidence ?? {}) ? (
              <ResultRow label="Indexed at" value={formatDateTime(evidence?.timestampIso)} />
            ) : null}
            {"method" in (evidence ?? {}) && evidence?.method ? (
              <ResultRow label="Method" value={String(evidence.method)} />
            ) : null}
            {"raw" in (evidence ?? {}) && evidence?.raw ? <ResultRow label="Raw result" value={String(evidence.raw)} /> : null}
            {"fullHost" in (evidence ?? {}) && evidence?.fullHost ? (
              <ResultRow label="Node" value={String(evidence.fullHost)} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BlacklistChecker() {
  const m = getMessages("en");

  const [address, setAddress] = React.useState("");
  const [validation, setValidation] = React.useState<ReturnType<typeof validateTronAddress> | null>(null);
  const [load, setLoad] = React.useState<LoadState>({ state: "idle" });

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
    return (
      typeof v.address === "string" &&
      typeof v.isValid === "boolean" &&
      typeof consensus?.status === "string" &&
      typeof consensus?.match === "boolean" &&
      typeof timestamps?.checkedAtIso === "string" &&
      typeof checks === "object"
    );
  }

  async function runCheck(nextAddress: string) {
    const v = validateTronAddress(nextAddress);
    setValidation(v);
    if (!v.ok) return;

    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/check", {
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
  const statusChip =
    consensus?.status === "blacklisted"
      ? { text: "Consensus: blacklisted", variant: "danger" as BadgeVariant }
      : consensus?.status === "not_blacklisted"
        ? { text: "Consensus: not blacklisted", variant: "success" as BadgeVariant }
        : consensus
          ? { text: "Consensus: inconclusive", variant: "warning" as BadgeVariant }
          : null;

  const matchChip =
    consensus && load.state === "success"
      ? load.data.consensus.match
        ? { text: "Both methods match", variant: "success" as BadgeVariant }
        : { text: "Mismatch / partial", variant: "warning" as BadgeVariant }
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">{m.title}</div>
            <div className="text-xs text-muted-foreground">Fast, privacy-first verification</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-14 sm:px-6">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{m.title}</h1>
          <p className="mt-3 text-pretty text-base text-muted-foreground sm:text-lg">{m.subtitle}</p>
        </section>

        <section className="mx-auto mt-8 max-w-3xl">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{m.noKeysBadge}</Badge>
                <Badge variant="outline">{m.noTrackingBadge}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Only paste a public TRON address. Never share seed phrases or private keys.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="tron-address" className="text-sm font-medium">
                  {m.inputLabel}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="tron-address"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={m.inputPlaceholder}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="sm:flex-1"
                    aria-invalid={address.trim().length > 0 && !isValid}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setAddress(text);
                          toast.success("Pasted");
                        } catch {
                          toast.error("Paste failed");
                        }
                      }}
                    >
                      {m.pasteCta}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddress("TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7")}
                    >
                      {m.exampleCta}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => runCheck(normalizedAddress)}
                      disabled={load.state === "loading" || !normalizedAddress || (validation !== null && !validation.ok)}
                    >
                      {load.state === "loading" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Checking
                        </>
                      ) : (
                        m.checkCta
                      )}
                    </Button>
                  </div>
                </div>

                {validation && !validation.ok ? (
                  <div className="text-sm text-red-600 dark:text-red-400">{validation.error}</div>
                ) : validation && validation.ok ? (
                  <div className="text-sm text-emerald-700 dark:text-emerald-300">Valid TRON address.</div>
                ) : (
                  <div className="text-sm text-muted-foreground">Tip: double-check the first and last 4 characters.</div>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">USDT contract:</span>
                  <a
                    href={tronscanContractUrl(USDT_TRC20_CONTRACT)}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline underline-offset-4 hover:opacity-80"
                  >
                    {USDT_TRC20_CONTRACT}
                  </a>
                  <CopyButton value={USDT_TRC20_CONTRACT} label="Contract copied" />
                </div>
                <a
                  href="https://tronscan.org/#/blockchain/contracts"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:opacity-80"
                >
                  Open TronScan
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto mt-6 max-w-3xl">
          <AnimatePresence mode="popLayout">
            {load.state === "loading" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <Skeleton className="h-20 w-full rounded-2xl" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-64 w-full rounded-2xl" />
                  <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
              </motion.div>
            ) : null}

            {load.state === "error" ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Couldn’t complete the check</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>{load.message}</div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={() => runCheck(normalizedAddress)} disabled={!isValid}>
                          Retry
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setLoad({ state: "idle" })}>
                          Clear
                        </Button>
                      </div>
                      <details className="rounded-xl border border-border/60 bg-background/40 p-3">
                        <summary className="cursor-pointer text-sm font-medium">Diagnostic details</summary>
                        <pre className="mt-2 overflow-auto text-xs text-muted-foreground">{load.details ?? "—"}</pre>
                      </details>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            ) : null}

            {load.state === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <StatusBanner data={load.data} />

                <Card>
                  <CardContent className="space-y-3 pt-6">
	                    <div className="flex flex-wrap items-center gap-2">
	                      {statusChip ? <Badge variant={statusChip.variant}>{statusChip.text}</Badge> : null}
	                      {matchChip ? <Badge variant={matchChip.variant}>{matchChip.text}</Badge> : null}
	                      <Badge variant="outline">Checked {formatDateTime(load.data.timestamps.checkedAtIso)}</Badge>
	                    </div>
                    <ResultRow
                      label="Address"
                      value={load.data.address}
                      copyValue={load.data.address}
                      href={tronscanAddressUrl(load.data.address)}
                    />
                    {load.data.notices?.length ? (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {load.data.notices.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>

                {load.data.consensus.status === "blacklisted" ? (
                  <Alert variant="danger">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Scam warning</AlertTitle>
                    <AlertDescription>
                      No legitimate service can “unblacklist” an address for a fee. Never share your seed phrase.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <MethodCard
                    title="TronScan Index"
                    description="Independent index/API data"
                    result={load.data.checks.tronscan}
                  />
                  <MethodCard
                    title="On-chain Contract Read"
                    description="Direct read from USDT contract"
                    result={load.data.checks.onchain}
                  />
                </div>

                <Tabs defaultValue="guidance" className="mt-2">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="guidance">Guidance</TabsTrigger>
                    <TabsTrigger value="faq">FAQ</TabsTrigger>
                  </TabsList>
                  <TabsContent value="guidance" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">What should I do next?</CardTitle>
                        <CardDescription>Practical next steps, without panic.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <ul className="list-disc space-y-2 pl-5">
                          <li>
                            If this is an exchange deposit/withdraw address, contact the exchange’s official support.
                          </li>
                          <li>Otherwise, only the issuer (Tether) can address blacklist decisions.</li>
                          <li>
                            Don’t pay “recovery” services. Never share seed phrases or private keys with anyone.
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="faq">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">FAQ</CardTitle>
                        <CardDescription>Quick answers to common questions.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="meaning">
                            <AccordionTrigger>What does “blacklisted” mean?</AccordionTrigger>
                            <AccordionContent>
                              The USDT smart contract can restrict addresses. If blacklisted, USDT transfers from that
                              address will likely revert on-chain.
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="moves">
                            <AccordionTrigger>What can/can’t move?</AccordionTrigger>
                            <AccordionContent>
                              This check only applies to USDT (TRC20). Other tokens or TRX may still be transferable,
                              depending on their contracts and rules.
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="privacy">
                            <AccordionTrigger>Do you store my address?</AccordionTrigger>
                            <AccordionContent>
                              No. This site doesn’t log or store addresses by default, and it has no analytics until you
                              opt in.
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        <footer className="mx-auto mt-12 max-w-3xl space-y-3 text-center text-sm text-muted-foreground">
          <p>Informational only; not legal advice. Always verify with official sources.</p>
          <p className="font-medium text-foreground">Never share seed phrases or private keys.</p>
          <p>
            Created by{" "}
            <a
              className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
              href="https://chikocorp.com"
              target="_blank"
              rel="noreferrer"
            >
              Chikocorp
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
