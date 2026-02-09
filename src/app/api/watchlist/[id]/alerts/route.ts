import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { updateWatchlistItemAlerts } from "@/lib/db/watchlist";

export const runtime = "nodejs";

const WatchlistItemIdSchema = z.string().uuid();

const UpdateAlertsSchema = z.object({
  enabled: z.boolean(),
  minAmountUsdt: z.string().optional(),
});

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

function usdtToBaseUnits(usdtAmount: string): string {
  // USDT has 6 decimals on TRON
  const parsed = parseFloat(usdtAmount);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error("Invalid USDT amount");
  }
  // Convert to base units (multiply by 10^6)
  const baseUnits = Math.round(parsed * 1_000_000);
  return String(baseUnits);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const params = await ctx.params;
  const parsedId = WatchlistItemIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid watchlist item id." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = UpdateAlertsSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let minAmountBase: string | null = null;
  if (parsed.data.enabled && parsed.data.minAmountUsdt !== undefined) {
    try {
      minAmountBase = usdtToBaseUnits(parsed.data.minAmountUsdt);
    } catch {
      return NextResponse.json({ error: "Invalid minAmountUsdt value." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
  }

  const updated = await updateWatchlistItemAlerts(db, userId, parsedId.data, {
    enabled: parsed.data.enabled,
    minAmountBase,
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      item: {
        id: updated.id,
        alertsEnabled: updated.alertsEnabled,
        alertsMinAmountBase: updated.alertsMinAmountBase,
        alertsUpdatedAt: updated.alertsUpdatedAt?.toISOString() ?? null,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
