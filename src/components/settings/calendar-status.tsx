"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function CalendarStatus({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    startTransition(async () => {
      await fetch("/api/calendar/disconnect", { method: "POST" });
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-medium">Calendar</h3>
      {connected ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-success font-medium">Google Calendar connected</p>
            <p className="text-xs text-muted-foreground">
              Morning recommendations adjust to your first meeting.
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
          >
            {isPending ? "..." : "Disconnect"}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Connect Google Calendar to adjust morning recommendations based on your first meeting.
          </p>
          <a
            href="/api/calendar/connect"
            className="tap-target inline-block rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
          >
            Connect Google Calendar
          </a>
        </>
      )}
    </div>
  );
}
