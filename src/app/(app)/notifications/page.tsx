import { Suspense } from "react";
import { NotificationHistory } from "@/components/notifications/notification-history";

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Recent alerts and reminders</p>
      </header>
      <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>}>
        <NotificationHistory />
      </Suspense>
    </div>
  );
}
