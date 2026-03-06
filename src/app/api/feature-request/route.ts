import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { featureRequests } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/api-guard";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

function fingerprint(title: string, description: string): string {
  const input = `${title.toLowerCase().trim()}:${description.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterSec } = checkRateLimit(session.user.id, "feature-request");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const body = await req.json();
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const category = body.category || "general";

  if (!title || title.length < 3) {
    return NextResponse.json({ error: "Title too short" }, { status: 400 });
  }
  if (!description || description.length < 10) {
    return NextResponse.json({ error: "Description too short" }, { status: 400 });
  }

  // Dedupe check
  const fp = fingerprint(title, description);
  const existing = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.userId, session.user.id), eq(featureRequests.fingerprint, fp)))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ ok: true, id: existing[0].id, deduplicated: true });
  }

  // Create request
  const [created] = await db
    .insert(featureRequests)
    .values({
      userId: session.user.id,
      title,
      description,
      category,
      fingerprint: fp,
    })
    .returning();

  // Optionally auto-file GitHub issue
  const ghToken = process.env.GITHUB_TOKEN;
  const ghOwner = process.env.GITHUB_OWNER;
  const ghRepo = process.env.GITHUB_REPO;
  const autoFile = process.env.AUTO_FILE_GH_ISSUES === "true";

  if (autoFile && ghToken && ghOwner && ghRepo) {
    try {
      const issueRes = await fetch(
        `https://api.github.com/repos/${ghOwner}/${ghRepo}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            title: `[Feature Request] ${title}`,
            body: `**Category:** ${category}\n\n${description}\n\n---\n*Auto-filed from commute-dashboard*`,
            labels: ["feature-request"],
          }),
        }
      );

      if (issueRes.ok) {
        const issue = await issueRes.json();
        await db
          .update(featureRequests)
          .set({ githubIssueNumber: issue.number, githubSyncStatus: "synced" })
          .where(eq(featureRequests.id, created.id));
      } else {
        const errText = await issueRes.text();
        await db
          .update(featureRequests)
          .set({ githubSyncStatus: "failed", githubSyncError: errText.slice(0, 500) })
          .where(eq(featureRequests.id, created.id));
      }
    } catch (err) {
      await db
        .update(featureRequests)
        .set({
          githubSyncStatus: "failed",
          githubSyncError: err instanceof Error ? err.message : "Unknown error",
        })
        .where(eq(featureRequests.id, created.id));
    }
  }

  return NextResponse.json({ ok: true, id: created.id });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await db
    .select()
    .from(featureRequests)
    .where(eq(featureRequests.userId, session.user.id))
    .orderBy(desc(featureRequests.createdAt))
    .limit(20);

  return NextResponse.json({ requests });
}
