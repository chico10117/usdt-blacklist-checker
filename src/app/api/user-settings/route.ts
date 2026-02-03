import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getUserSettings, upsertUserSettings } from "@/lib/db/user-settings";
import { validateSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const UpdateUserSettingsSchema = z.object({
  loggingEnabled: z.boolean(),
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

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { loggingEnabled: false, persistenceAvailable: false },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const settings = await getUserSettings(db, userId);
  return NextResponse.json(
    { loggingEnabled: settings?.loggingEnabled ?? false, persistenceAvailable: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
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
    return NextResponse.json(
      { error: "Persistence is disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = UpdateUserSettingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const updated = await upsertUserSettings(db, userId, parsed.data.loggingEnabled);
  return NextResponse.json(
    { loggingEnabled: updated?.loggingEnabled ?? parsed.data.loggingEnabled, persistenceAvailable: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
