import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { deleteWatchlistItemById } from "@/lib/db/watchlist";
import { validateSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const WatchlistItemIdSchema = z.string().uuid();

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const origin = validateSameOrigin(_request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
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

  const deleted = await deleteWatchlistItemById(db, userId, parsedId.data);
  if (!deleted) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ deleted: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
