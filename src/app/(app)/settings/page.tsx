import { Suspense } from "react";
import Link from "next/link";
import { SettingsForm } from "@/components/settings/settings-form";
import { CalendarStatus } from "@/components/settings/calendar-status";
import { getSettings } from "@/lib/actions/settings";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const [settings, session] = await Promise.all([getSettings(), auth()]);

  const [calConn] = session?.user?.id
    ? await db
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.userId, session.user.id))
        .limit(1)
    : [null];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your commute preferences
        </p>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <SettingsForm
          settings={
            settings
              ? {
                  walkHomeToJsq: settings.walkHomeToJsq,
                  walkWtcToOffice: settings.walkWtcToOffice,
                  walkOfficeToWtc: settings.walkOfficeToWtc,
                  walkJsqToHome: settings.walkJsqToHome,
                  morningWindowStart: settings.morningWindowStart,
                  morningWindowEnd: settings.morningWindowEnd,
                  eveningWindowStart: settings.eveningWindowStart,
                  eveningWindowEnd: settings.eveningWindowEnd,
                  pushEnabled: settings.pushEnabled,
                  pushLeaveReminder: settings.pushLeaveReminder,
                  pushServiceAlert: settings.pushServiceAlert,
                  pushWeatherAlert: settings.pushWeatherAlert,
                  activeRoutes: settings.activeRoutes ?? [settings.activeRoute],
                }
              : null
          }
        />
      </Suspense>

      {/* Calendar integration with disconnect */}
      <CalendarStatus connected={!!calConn?.accessToken} />

      {/* Links */}
      <div className="rounded-xl bg-card p-4 shadow-sm space-y-3">
        <Link
          href="/notifications"
          className="flex items-center justify-between text-sm"
        >
          <span>Notification History</span>
          <span className="text-muted-foreground">→</span>
        </Link>
        <div className="border-t border-border" />
        <Link
          href="/feature-request"
          className="flex items-center justify-between text-sm"
        >
          <span>Feature Request</span>
          <span className="text-muted-foreground">→</span>
        </Link>
        <div className="border-t border-border" />
        <Link
          href="/onboarding?reset=1"
          className="flex items-center justify-between text-sm"
        >
          <span>Run Onboarding Again</span>
          <span className="text-muted-foreground">→</span>
        </Link>
      </div>

      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{session?.user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/auth/signin" }); }}>
            <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
