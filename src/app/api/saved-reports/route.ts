import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { createSavedReport, deleteAllSavedReportsForUser, listSavedReportsSummary } from "@/lib/db/saved-reports";
import { getUserSettings } from "@/lib/db/user-settings";
import { TronAddressSchema } from "@/lib/validators";
import { validateSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const RiskTierSchema = z.enum(["low", "guarded", "elevated", "high", "severe"]);

const SaveReportBodySchema = z.object({
  address: TronAddressSchema,
  report: z.unknown(),
});

const AnalyzeReportSchema = z
  .object({
    address: TronAddressSchema,
    risk: z.object({
      score: z.number(),
      tier: RiskTierSchema,
      confidence: z.number(),
    }),
    checks: z
      .object({
        exposure1hop: z.unknown().optional(),
        tracing2hop: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function deriveWindow(report: z.infer<typeof AnalyzeReportSchema>): unknown {
  const exposure = report.checks?.exposure1hop as Record<string, unknown> | undefined;
  if (exposure && exposure.ok === true && exposure.window && typeof exposure.window === "object") {
    return exposure.window;
  }

  const tracing = report.checks?.tracing2hop as Record<string, unknown> | undefined;
  if (tracing && tracing.ok === true && tracing.window && typeof tracing.window === "object") {
    return tracing.window;
  }

  return { lookbackDays: 90 };
}

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = clampInt(limitRaw ? Number(limitRaw) : 50, 1, 100);

  const reports = await listSavedReportsSummary(db, userId, limit);
  return NextResponse.json(
    {
      reports: reports.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const origin = validateSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  if (!process.env.ADDRESS_HASH_KEY) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const settings = await getUserSettings(db, userId);
  if (!settings?.loggingEnabled) {
    return NextResponse.json(
      { error: "Saving is disabled. Enable it in Settings first." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = SaveReportBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const reportParsed = AnalyzeReportSchema.safeParse(parsed.data.report);
  if (!reportParsed.success) {
    return NextResponse.json({ error: "Invalid report payload." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (reportParsed.data.address !== parsed.data.address) {
    return NextResponse.json(
      { error: "Report address mismatch." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const report = reportParsed.data;
  const created = await createSavedReport(db, userId, {
    address: parsed.data.address,
    riskScore: clampInt(report.risk.score, 0, 100),
    riskTier: report.risk.tier,
    confidence: clampInt(report.risk.confidence, 0, 100),
    window: deriveWindow(report),
    reportJson: parsed.data.report,
  });

  if (!created) {
    return NextResponse.json({ error: "Failed to save report." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { id: created.id, createdAt: created.createdAt },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const origin = validateSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const deletedCount = await deleteAllSavedReportsForUser(db, userId);
  return NextResponse.json({ deletedCount }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
