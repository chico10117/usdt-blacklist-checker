import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/lib/db";
import { createWatchlistItem, listWatchlistItems, listWatchlistItemsForAddress } from "@/lib/db/watchlist";
import { ensureUserSettingsExists } from "@/lib/db/user-settings";
import { TronAddressSchema } from "@/lib/validators";
import { fetchUsdtBalance } from "@/lib/tronscan";

export const runtime = "nodejs";

const CreateWatchlistItemSchema = z.object({
  address: TronAddressSchema,
  label: z.string().optional().nullable(),
});

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
  const refreshBalances = url.searchParams.get("refreshBalances") === "true";

  const items = await listWatchlistItems(db, userId, limit);

  // If refreshBalances is requested, fetch fresh balances for all items
  let itemsWithBalances = items;
  if (refreshBalances && items.length > 0) {
    const balancePromises = items.map(async (item) => {
      const balanceRes = await fetchUsdtBalance(item.address);
      return {
        ...item,
        usdtBalance: balanceRes.ok ? balanceRes.balance : item.usdtBalance,
      };
    });
    itemsWithBalances = await Promise.all(balancePromises);

    // Update balances in database (fire and forget)
    for (const item of itemsWithBalances) {
      if (item.usdtBalance !== items.find((i) => i.id === item.id)?.usdtBalance) {
        db.update(schema.watchlistItems)
          .set({ usdtBalance: item.usdtBalance })
          .where(eq(schema.watchlistItems.id, item.id))
          .execute()
          .catch(() => {});
      }
    }
  }

  return NextResponse.json(
    {
      items: itemsWithBalances.map((item) => ({
        id: item.id,
        address: item.address,
        label: item.label,
        usdtBalance: item.usdtBalance,
        createdAt: item.createdAt.toISOString(),
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

  if (!process.env.ADDRESS_HASH_KEY) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
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

  const parsed = CreateWatchlistItemSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const labelRaw = parsed.data.label;
  const label = typeof labelRaw === "string" ? labelRaw.trim() : null;
  if (label && label.length > 80) {
    return NextResponse.json({ error: "Label is too long." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const existing = await listWatchlistItemsForAddress(db, userId, parsed.data.address, 1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Address is already on your watchlist." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  await ensureUserSettingsExists(db, userId);

  // Fetch USDT balance for the address
  const balanceRes = await fetchUsdtBalance(parsed.data.address);
  const usdtBalance = balanceRes.ok ? balanceRes.balance : null;

  const created = await createWatchlistItem(db, userId, {
    address: parsed.data.address,
    label: label && label.length > 0 ? label : null,
    usdtBalance,
  });

  if (!created) {
    return NextResponse.json({ error: "Failed to add watchlist item." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      item: {
        id: created.id,
        address: created.address,
        label: created.label,
        usdtBalance: created.usdtBalance,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
