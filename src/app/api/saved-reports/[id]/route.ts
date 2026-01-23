import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { deleteSavedReportById, getSavedReportById } from "@/lib/db/saved-reports";

export const runtime = "nodejs";

const ReportIdSchema = z.string().uuid();

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const params = await ctx.params;
  const parsedId = ReportIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid report id." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const report = await getSavedReportById(db, userId, parsedId.data);
  if (!report) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      ...report,
      createdAt: report.createdAt.toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const params = await ctx.params;
  const parsedId = ReportIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid report id." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Persistence is disabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const deleted = await deleteSavedReportById(db, userId, parsedId.data);
  if (!deleted) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ deleted: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
