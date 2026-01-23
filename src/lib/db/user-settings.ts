import "server-only";

import { eq } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { schema } from "@/lib/db";

export function buildGetUserSettingsQuery(db: DbClient, userId: string) {
  return db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1);
}

export async function getUserSettings(db: DbClient, userId: string) {
  const rows = await buildGetUserSettingsQuery(db, userId).execute();
  return rows[0] ?? null;
}

export async function upsertUserSettings(db: DbClient, userId: string, loggingEnabled: boolean) {
  const rows = await db
    .insert(schema.userSettings)
    .values({ userId, loggingEnabled })
    .onConflictDoUpdate({
      target: schema.userSettings.userId,
      set: {
        loggingEnabled,
        updatedAt: new Date(),
      },
    })
    .returning()
    .execute();

  return rows[0] ?? null;
}

