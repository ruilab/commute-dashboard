import { getInsightsData } from "@/lib/actions/insights";
import { DurationChart } from "./duration-chart";

const TAG_LABELS: Record<string, string> = {
  path_delay: "PATH delay",
  crowded: "Crowded platform",
  missed_train: "Missed train",
  bad_weather: "Bad weather",
  slow_walking: "Slow walking",
};

function StatCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value}
        {unit && (
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            {unit}
          </span>
        )}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export async function InsightsContent() {
  let data;
  try {
    data = await getInsightsData();
  } catch {
    return (
      <div className="rounded-xl bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">
          Unable to load insights. Check your database connection.
        </p>
      </div>
    );
  }

  const hasData = data.overall !== null;
  const hasStreaks = data.streaks !== null && data.streaks.totalCommutes > 0;

  return (
    <div className="space-y-6">
      {/* Streaks section */}
      {hasStreaks && data.streaks && (
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-medium">Streaks & Records</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {data.streaks.checkinStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">Day streak</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">
                {data.streaks.onTimeStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">On-time</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {data.streaks.totalCommutes}
              </p>
              <p className="text-[10px] text-muted-foreground">Total trips</p>
            </div>
          </div>

          {(data.streaks.fastestOutbound || data.streaks.fastestReturn) && (
            <div className="mt-3 flex gap-4 text-sm">
              {data.streaks.fastestOutbound && (
                <div className="flex items-center gap-1">
                  <span>🏆</span>
                  <span className="text-muted-foreground">
                    Best AM: {data.streaks.fastestOutbound} min
                  </span>
                </div>
              )}
              {data.streaks.fastestReturn && (
                <div className="flex items-center gap-1">
                  <span>🏆</span>
                  <span className="text-muted-foreground">
                    Best PM: {data.streaks.fastestReturn} min
                  </span>
                </div>
              )}
            </div>
          )}

          {data.streaks.thisWeek.commutes > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                This week: {data.streaks.thisWeek.commutes} trips
                {data.streaks.thisWeek.avgDuration &&
                  `, avg ${data.streaks.thisWeek.avgDuration} min`}
                {" · "}
                {data.streaks.thisWeek.checkinDays}/
                {data.streaks.thisWeek.weekdaysElapsed} weekdays
              </p>
            </div>
          )}

          {data.streaks.thisMonth.commutes > 0 && data.streaks.thisMonth.bestDay && (
            <p className="mt-1 text-xs text-muted-foreground">
              This month: best day is{" "}
              <span className="font-medium">{data.streaks.thisMonth.bestDay}</span>
              {data.streaks.thisMonth.onTimePct !== null &&
                ` · ${data.streaks.thisMonth.onTimePct}% on-time`}
            </p>
          )}

          {data.streaks.longestCheckinStreak > data.streaks.checkinStreak && (
            <p className="mt-1 text-xs text-muted-foreground">
              Record streak: {data.streaks.longestCheckinStreak} days
            </p>
          )}
        </div>
      )}

      {/* Correlation insights */}
      {data.correlations &&
        data.correlations.insights.length > 0 && (
          <div className="rounded-xl bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-medium">Learned Patterns</h3>
            <div className="space-y-3">
              {data.correlations.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5">
                    {insight.type === "weather_impact"
                      ? "🌧️"
                      : insight.type === "delay_pattern"
                        ? "⏰"
                        : "📊"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {insight.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {data.correlations.dataPoints > 0 && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                Based on {data.correlations.dataPoints} data points
              </p>
            )}
          </div>
        )}

      {!hasData && (
        <div className="rounded-xl bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">
            Not enough data yet. Complete some commutes to see insights.
          </p>
        </div>
      )}

      {hasData && data.overall && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Avg door-to-door"
              value={data.overall.avg}
              unit="min"
              sub={`${data.totalTrips} trips last 30d`}
            />
            <StatCard
              label="Median"
              value={data.overall.median}
              unit="min"
              sub={`${data.overall.min}–${data.overall.max} range`}
            />
            {data.outbound && (
              <StatCard
                label="Morning avg"
                value={data.outbound.avg}
                unit="min"
                sub={`${data.outbound.count} outbound`}
              />
            )}
            {data.returnTrips && (
              <StatCard
                label="Evening avg"
                value={data.returnTrips.avg}
                unit="min"
                sub={`${data.returnTrips.count} return`}
              />
            )}
          </div>

          {/* Weekly trend */}
          {data.dailyAvg.some((d) => d.outbound || d.returnTrip) && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-medium">This Week</h3>
              <DurationChart data={data.dailyAvg} />
            </div>
          )}

          {/* Best departure bands */}
          {data.outboundBands.length > 0 && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-medium">Fastest Morning Departures</h3>
              <div className="space-y-2">
                {data.outboundBands.map((b, i) => (
                  <div
                    key={b.band}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {i === 0 && <span>🏆</span>}
                      <span>{b.band}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {b.avgDuration} min avg ({b.count}x)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.returnBands.length > 0 && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-medium">Fastest Evening Returns</h3>
              <div className="space-y-2">
                {data.returnBands.map((b, i) => (
                  <div
                    key={b.band}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {i === 0 && <span>🏆</span>}
                      <span>{b.band}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {b.avgDuration} min avg ({b.count}x)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather impact buckets */}
          {data.correlations &&
            data.correlations.weatherBuckets.length > 1 && (
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <h3 className="mb-3 font-medium">Weather Impact</h3>
                <div className="space-y-2">
                  {data.correlations.weatherBuckets.map((b) => (
                    <div
                      key={b.condition}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">{b.condition}</span>
                      <span className="text-muted-foreground">
                        {b.avgDuration} min avg ({b.count}x)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Tag frequency */}
          {Object.keys(data.tagCounts).length > 0 && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-medium">Issue Frequency</h3>
              <div className="space-y-2">
                {Object.entries(data.tagCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tag, count]) => (
                    <div
                      key={tag}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{TAG_LABELS[tag] || tag}</span>
                      <span className="text-muted-foreground">{count}x</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
