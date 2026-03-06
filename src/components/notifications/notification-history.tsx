import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notificationLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

const TYPE_ICONS: Record<string, string> = {
  leave_reminder: "🔔",
  service_alert: "🚇",
  weather_alert: "⛈️",
};

export async function NotificationHistory() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const notifications = await db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.userId, session.user.id))
    .orderBy(desc(notificationLog.createdAt))
    .limit(50);

  if (notifications.length === 0) {
    return (
      <div className="rounded-xl bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">No notifications yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable push notifications in Settings to receive alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 rounded-xl bg-card p-3 shadow-sm"
        >
          <span className="mt-0.5 text-lg">
            {TYPE_ICONS[n.type] || "📨"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{n.title}</p>
            <p className="text-xs text-muted-foreground truncate">{n.body}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {new Date(n.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/New_York",
              })}
              {!n.delivered && (
                <span className="ml-1 text-warning">· Not delivered</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
