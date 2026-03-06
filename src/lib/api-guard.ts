import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";

/**
 * Verify the request origin for write endpoints (CSRF protection).
 * In production, rejects requests from unknown origins.
 * Returns null if OK, or an error response to return immediately.
 */
export function checkOrigin(req: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Allow requests with no origin (server-to-server, curl, cron)
  if (!origin && !referer) return null;

  const appUrl = getAppUrl();
  const allowedOrigins = [
    new URL(appUrl).origin,
    // Vercel preview URLs
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
