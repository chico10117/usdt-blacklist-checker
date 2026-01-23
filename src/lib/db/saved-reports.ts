import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { computeAddressHash } from "@/lib/db/address-hash";
import { schema } from "@/lib/db";

export type SavedReportCreateInput = {
  address: string;
  riskScore: number;
  riskTier: string;
  confidence: number;
  window: unknown;
  reportJson: unknown;
};

export type SavedReportSummary = {
  id: string;
  address: string;
  riskScore: number;
  riskTier: string;
  confidence: number;
  window: unknown;
  createdAt: Date;
};

export function buildGetSavedReportByIdQuery(db: DbClient, userId: string, reportId: string) {
  return db
    .select()
    .from(schema.savedReports)
    .where(and(eq(schema.savedReports.userId, userId), eq(schema.savedReports.id, reportId)))
    .limit(1);
}

export async function getSavedReportById(db: DbClient, userId: string, reportId: string) {
  const rows = await buildGetSavedReportByIdQuery(db, userId, reportId).execute();
  return rows[0] ?? null;
}

export function buildListSavedReportsQuery(db: DbClient, userId: string, limit = 50) {
  return db
    .select()
    .from(schema.savedReports)
    .where(eq(schema.savedReports.userId, userId))
    .orderBy(desc(schema.savedReports.createdAt))
    .limit(limit);
}

export function buildListSavedReportsSummaryQuery(db: DbClient, userId: string, limit = 50) {
  return db
    .select({
      id: schema.savedReports.id,
      address: schema.savedReports.address,
      riskScore: schema.savedReports.riskScore,
      riskTier: schema.savedReports.riskTier,
      confidence: schema.savedReports.confidence,
      window: schema.savedReports.window,
      createdAt: schema.savedReports.createdAt,
    })
    .from(schema.savedReports)
    .where(eq(schema.savedReports.userId, userId))
    .orderBy(desc(schema.savedReports.createdAt))
    .limit(limit);
}

export async function listSavedReportsSummary(db: DbClient, userId: string, limit = 50): Promise<SavedReportSummary[]> {
  return await buildListSavedReportsSummaryQuery(db, userId, limit).execute();
}

export function buildListSavedReportsForAddressQuery(db: DbClient, userId: string, address: string, limit = 50) {
  const addressHash = computeAddressHash(userId, address);
  return db
    .select()
    .from(schema.savedReports)
    .where(and(eq(schema.savedReports.userId, userId), eq(schema.savedReports.addressHash, addressHash)))
    .orderBy(desc(schema.savedReports.createdAt))
    .limit(limit);
}

export async function createSavedReport(db: DbClient, userId: string, input: SavedReportCreateInput) {
  const addressHash = computeAddressHash(userId, input.address);

  const rows = await db
    .insert(schema.savedReports)
    .values({
      userId,
      address: input.address,
      addressHash,
      riskScore: input.riskScore,
      riskTier: input.riskTier,
      confidence: input.confidence,
      window: input.window,
      reportJson: input.reportJson,
    })
    .returning()
    .execute();

  return rows[0] ?? null;
}

export async function deleteSavedReportById(db: DbClient, userId: string, reportId: string) {
  const rows = await db
    .delete(schema.savedReports)
    .where(and(eq(schema.savedReports.userId, userId), eq(schema.savedReports.id, reportId)))
    .returning({ id: schema.savedReports.id })
    .execute();

  return rows[0] ?? null;
}

export async function deleteAllSavedReportsForUser(db: DbClient, userId: string) {
  const rows = await db
    .delete(schema.savedReports)
    .where(eq(schema.savedReports.userId, userId))
    .returning({ id: schema.savedReports.id })
    .execute();

  return rows.length;
}
