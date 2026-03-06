import { getRecentSessions } from "@/lib/actions/commute";
import { formatDuration, formatTimeShort, formatDateShort } from "@/lib/utils";

const TAG_LABELS: Record<string, string> = {
  path_delay: "⏰ Delay",
  crowded: "👥 Crowded",
  missed_train: "🏃 Missed",
  bad_weather: "🌧️ Weather",
  slow_walking: "🚶 Slow",
};

export async function HistoryList() {
  const sessions = await getRecentSessions(30);

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">No commutes recorded yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a check-in to begin tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map(({ session: s, events, tags }) => {
        const isComplete = s.completedAt !== null;
        const duration = s.totalDurationMin;

        return (
          <div key={s.id} className="rounded-xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>
                  {s.direction === "outbound" ? "🌅" : "🌆"}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {s.direction === "outbound" ? "To Office" : "To Home"}
                    {s.route && s.route !== "JSQ-WTC" && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        via {s.route}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(new Date(s.startedAt))} ·{" "}
                    {formatTimeShort(new Date(s.startedAt))}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {isComplete && duration ? (
                  <p className="font-semibold">{formatDuration(duration)}</p>
                ) : (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                    In progress
                  </span>
                )}
              </div>
            </div>

            {/* Event timeline */}
            {events.length > 1 && (
              <div className="mt-3 flex items-center gap-1 overflow-x-auto">
                {events.map((e, idx) => (
                  <div key={e.step} className="flex items-center">
                    <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] text-success whitespace-nowrap">
                      {formatTimeShort(new Date(e.timestamp))}
                    </span>
                    {idx < events.length - 1 && (
                      <span className="mx-0.5 text-muted-foreground">→</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t.tag}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    {TAG_LABELS[t.tag] || t.tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
