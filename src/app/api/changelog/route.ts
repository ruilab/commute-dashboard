import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { changelogEntries } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/**
 * POST /api/changelog — Publish a changelog entry.
 * Protected by CRON_SECRET (admin-only).
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = checkRateLimit("system", "cron");
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const body = await req.json();
  const { version, title, content, category } = body;

  if (!version || !title || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [entry] = await db
    .insert(changelogEntries)
    .values({
      version,
      title,
      body: content,
      category: category || "improvement",
    })
    .returning();

  return NextResponse.json({ ok: true, id: entry.id });
}

/**
 * GET /api/changelog — List changelog entries.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db
    .select()
    .from(changelogEntries)
    .orderBy(changelogEntries.publishedAt)
    .limit(50);

  return NextResponse.json({ entries });
}
