import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";
import { getSettings } from "@/lib/actions/settings";
import { auth, signOut } from "@/lib/auth";

export default async function SettingsPage() {
  const [settings, session] = await Promise.all([getSettings(), auth()]);

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
                  activeRoute: settings.activeRoute,
                }
              : null
          }
        />
      </Suspense>

      {/* Calendar integration */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-medium">Calendar</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Connect Google Calendar to adjust morning recommendations based on
          your first meeting time.
        </p>
        <a
          href="/api/calendar/connect"
          className="tap-target inline-block rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
        >
          Connect Google Calendar
        </a>
      </div>

      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/auth/signin" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
