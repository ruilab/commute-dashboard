import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/api-guard";
import { NextResponse } from "next/server";

/**
 * Feature request → GitHub issue.
 * No DB persistence — files directly as a GitHub issue.
 */
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
    return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 });
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "Title too long (max 200)" }, { status: 400 });
  }
  if (!description || description.length < 10) {
    return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
  }
  if (description.length > 2000) {
    return NextResponse.json({ error: "Description too long (max 2000)" }, { status: 400 });
  }

  const ghToken = process.env.GITHUB_TOKEN;
  const ghOwner = process.env.GITHUB_OWNER || "ruilab";
  const ghRepo = process.env.GITHUB_REPO || "commute-dashboard";

  if (!ghToken) {
    return NextResponse.json({ error: "Feature requests not configured" }, { status: 503 });
  }

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
        body: `**Category:** ${category}\n\n${description}\n\n---\n*Submitted by ${session.user.name || "user"} via commute-dashboard*`,
        labels: ["feature-request"],
      }),
    }
  );

  if (!issueRes.ok) {
    const errText = await issueRes.text();
    console.error("[feature-request] GitHub API error:", errText.slice(0, 200));
    return NextResponse.json({ error: "Failed to create issue" }, { status: 502 });
  }

  const issue = await issueRes.json();
  return NextResponse.json({
    ok: true,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  });
}
