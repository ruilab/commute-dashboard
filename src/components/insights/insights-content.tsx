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

  if (!data.overall) {
    return (
      <div className="rounded-xl bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">
          Not enough data yet. Complete some commutes to see insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
    </div>
  );
}
