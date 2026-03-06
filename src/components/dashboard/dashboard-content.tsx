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
        {data.transit.headwayMin && (
          <p className="mt-1 text-xs text-muted-foreground">
            ~{data.transit.headwayMin} min headway
            {data.transit.isStale && " (data may be stale)"}
          </p>
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
