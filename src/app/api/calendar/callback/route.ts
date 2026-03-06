import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Google Calendar OAuth callback.
 * Exchanges auth code for tokens and stores them.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/auth/signin", req.url).toString()
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings?calendar=error", req.url).toString()
    );
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/calendar/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?calendar=error", req.url).toString()
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL("/settings?calendar=error", req.url).toString()
      );
    }

    const tokens = await tokenRes.json();

    // Upsert calendar connection
    const existing = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, session.user.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(calendarConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing[0].refreshToken,
          expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
          enabled: true,
        })
        .where(eq(calendarConnections.userId, session.user.id));
    } else {
      await db.insert(calendarConnections).values({
        userId: session.user.id,
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      });
    }

    return NextResponse.redirect(
      new URL("/settings?calendar=connected", req.url).toString()
    );
  } catch {
    return NextResponse.redirect(
      new URL("/settings?calendar=error", req.url).toString()
    );
  }
}
