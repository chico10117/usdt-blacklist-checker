import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/lib/db";
import { listWatchlistEventsForUser } from "@/lib/db/alerts";

export const runtime = "nodejs";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
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
  const limit = clampInt(limitRaw ? Number(limitRaw) : 200, 1, 200);

  const items = await listWatchlistEventsForUser(db, userId, limit);

  return NextResponse.json(
    {
      items: items.map((item) => ({
        id: item.id,
        watchlistItemId: item.watchlistItemId,
        txHash: item.txHash,
        tokenContract: item.tokenContract,
        amountBase: item.amountBase,
        fromAddress: item.fromAddress,
        toAddress: item.toAddress,
        blockTsMs: item.blockTsMs,
        createdAt: item.createdAt.toISOString(),
        address: item.address,
        label: item.label,
      })),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
