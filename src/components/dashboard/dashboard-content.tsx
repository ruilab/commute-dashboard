import { getDashboardData } from "@/lib/actions/dashboard";

function ConfidenceBadge({
  level,
}: {
  level: "high" | "medium" | "low";
}) {
  const styles = {
    high: "bg-success/10 text-success",
    medium: "bg-warning/10 text-warning",
    low: "bg-danger/10 text-danger",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[level]}`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "normal"
      ? "bg-success"
      : status === "delays"
        ? "bg-warning"
        : status === "suspended"
          ? "bg-danger"
          : "bg-muted-foreground";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function WeatherIcon({ condition }: { condition: string }) {
  const icons: Record<string, string> = {
    clear: "☀️",
    cloudy: "☁️",
    fog: "🌫️",
    drizzle: "🌦️",
    rain: "🌧️",
    snow: "🌨️",
    thunderstorm: "⛈️",
    unknown: "❓",
  };
  return <span>{icons[condition] || "🌤️"}</span>;
}

export async function DashboardContent() {
  let data;
  try {
    data = await getDashboardData();
  } catch {
    return (
      <div className="rounded-xl bg-card p-4 text-center">
        <p className="text-muted-foreground">
          Unable to load dashboard data. Check your database connection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Transit Status */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚇</span>
            <h2 className="font-medium">PATH Status</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={data.transit.status} />
            <span className="text-sm capitalize">{data.transit.status}</span>
          </div>
        </div>

        {data.transit.advisoryText && (
          <p className="mt-2 text-sm text-muted-foreground">
            {data.transit.advisoryText}
          </p>
        )}

        {/* Next arrivals */}
        {data.transit.nextArrivals.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {data.transit.nextArrivals.slice(0, 3).map((arr, i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-lg bg-secondary px-2.5 py-1.5"
              >
                <p className="text-sm font-medium">
                  {arr.arrivalMinutes <= 1
                    ? "Now"
                    : `${arr.arrivalMinutes} min`}
                </p>
                <p className="text-[10px] text-muted-foreground truncate max-w-20">
                  {arr.destination || arr.lineName}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {data.transit.headwayMin && (
            <span>
              ~{data.transit.headwayMin} min headway
              {data.transit.realHeadwayMin !== null && " (live)"}
            </span>
          )}
          {data.transit.isWeekendSchedule && (
            <span className="rounded bg-muted px-1.5 py-0.5">
              Weekend sched
            </span>
          )}
          {data.transit.isPlannedWork && (
            <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
              Planned work
            </span>
          )}
          {data.transit.isStale && (
            <span className="text-warning">Stale data</span>
          )}
        </div>

        {/* Service alerts */}
        {data.transit.serviceAlerts.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {data.transit.serviceAlerts.slice(0, 2).map((alert, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-xs ${
                  alert.severity === "severe"
                    ? "bg-danger/10 text-danger"
                    : alert.severity === "warning"
                      ? "bg-warning/10 text-warning"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {alert.description}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weather Summary */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WeatherIcon condition={data.weather.condition} />
            <h2 className="font-medium">Weather</h2>
          </div>
          <span className="text-lg font-medium">
            {data.weather.source !== "unavailable"
              ? `${Math.round(data.weather.temperature)}°F`
              : "N/A"}
          </span>
        </div>
        {data.weather.source !== "unavailable" && (
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>Feels {Math.round(data.weather.feelsLike)}°</span>
            {data.weather.precipProbability > 0 && (
              <span>
                {Math.round(data.weather.precipProbability)}%{" "}
                {data.weather.precipType || "precip"}
              </span>
            )}
            {data.weather.windSpeed > 5 && (
              <span>{Math.round(data.weather.windSpeed)} mph wind</span>
            )}
          </div>
        )}
        {/* Hourly forecast ribbon */}
        {data.weather.forecastHours.length > 0 && (
          <div className="mt-3 flex gap-3 overflow-x-auto">
            {data.weather.forecastHours.slice(0, 5).map((h) => (
              <div key={h.hour} className="flex-shrink-0 text-center">
                <p className="text-[10px] text-muted-foreground">
                  {h.hour > 12 ? h.hour - 12 : h.hour}
                  {h.hour >= 12 ? "p" : "a"}
                </p>
                <WeatherIcon condition={h.condition} />
                <p className="text-xs">{Math.round(h.temperature)}°</p>
                {h.precipProbability > 20 && (
                  <p className="text-[10px] text-primary">
                    {Math.round(h.precipProbability)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Morning Recommendation */}
      <RecommendationCard
        title="Morning Departure"
        icon="🌅"
        bestBand={data.morningRec.bestBand}
        fallbacks={data.morningRec.fallbackBands}
        confidence={data.morningRec.confidence}
        explanation={data.morningRec.explanation}
        estimatedMinutes={data.morningRec.estimatedMinutes}
      />

      {/* Evening Recommendation */}
      <RecommendationCard
        title="Evening Return"
        icon="🌆"
        bestBand={data.eveningRec.bestBand}
        fallbacks={data.eveningRec.fallbackBands}
        confidence={data.eveningRec.confidence}
        explanation={data.eveningRec.explanation}
        estimatedMinutes={data.eveningRec.estimatedMinutes}
      />

      <p className="text-center text-xs text-muted-foreground">
        Updated{" "}
        {new Date(data.generatedAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        })}
        {" · "}
        <span className="capitalize">{data.transit.source.replace("-", " ")}</span>
      </p>
    </div>
  );
}

function RecommendationCard({
  title,
  icon,
  bestBand,
  fallbacks,
  confidence,
  explanation,
  estimatedMinutes,
}: {
  title: string;
  icon: string;
  bestBand: string;
  fallbacks: string[];
  confidence: "high" | "medium" | "low";
  explanation: string;
  estimatedMinutes: number;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-medium">{title}</h2>
        </div>
        <ConfidenceBadge level={confidence} />
      </div>

      <div className="mt-3">
        <p className="text-2xl font-semibold text-primary">{bestBand}</p>
        <p className="text-sm text-muted-foreground">
          ~{estimatedMinutes} min door-to-door
        </p>
      </div>

      {fallbacks.length > 0 && (
        <div className="mt-3 flex gap-2">
          {fallbacks.map((fb) => (
            <span
              key={fb}
              className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
            >
              {fb}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {explanation}
      </p>
    </div>
  );
}
