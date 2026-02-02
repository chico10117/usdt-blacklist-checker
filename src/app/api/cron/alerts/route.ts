import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { runAlertsOnce } from "@/lib/monitoring/alerts-runner";

export const runtime = "nodejs";

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const expectedSecret = getCronSecret();
  if (!expectedSecret) return false;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const providedSecret = match[1];
  return providedSecret === expectedSecret;
}

export async function POST(request: Request) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Check persistence is enabled
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Persistence is disabled" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runAlertsOnce(db, {
      maxItems: 50,
      limitPerItem: 50,
    });

    return NextResponse.json(
      {
        ok: true,
        processedItems: result.processedItems,
        insertedEvents: result.insertedEvents,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Do not log addresses or tx hashes
    const message = error instanceof Error ? "Internal error" : "Internal error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
