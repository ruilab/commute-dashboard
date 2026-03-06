import { getDashboardData } from "@/lib/actions/dashboard";

/**
 * Minimal widget page — optimized for phone home screen shortcut.
 * Shows single-card recommendation, auto-selects AM/PM based on time.
 * No nav bar, no chrome — just the answer.
 */
export default async function WidgetPage() {
  let data;
  try {
    data = await getDashboardData();
  } catch {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Unable to load. Tap to retry.</p>
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const isEvening = hour >= 15;

  const rec = isEvening ? data.eveningRec : data.morningRec;
  const label = isEvening ? "Leave WTC" : "Leave Home";

  const confidenceColor = {
    high: "text-success",
    medium: "text-warning",
    low: "text-danger",
  }[rec.confidence];

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        {/* Transit indicator */}
        <div className="flex items-center justify-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              data.transit.status === "normal"
                ? "bg-success"
                : data.transit.status === "delays"
                  ? "bg-warning"
                  : "bg-danger"
            }`}
          />
          <span className="text-sm text-muted-foreground capitalize">
            PATH {data.transit.status}
          </span>
        </div>

        {/* Main recommendation */}
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-4xl font-bold text-primary">
            {rec.bestBand}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            ~{rec.estimatedMinutes} min ·{" "}
            <span className={confidenceColor}>
              {rec.confidence} confidence
            </span>
          </p>
        </div>

        {/* Fallbacks */}
        {rec.fallbackBands.length > 0 && (
          <div className="flex justify-center gap-2">
            {rec.fallbackBands.map((fb) => (
              <span
                key={fb}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {fb}
              </span>
            ))}
          </div>
        )}

        {/* Explanation */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {rec.explanation}
        </p>

        {/* Weather one-liner */}
        {data.weather.source !== "unavailable" && (
          <p className="text-xs text-muted-foreground">
            {Math.round(data.weather.temperature)}°F
            {data.weather.precipProbability > 20 &&
              ` · ${Math.round(data.weather.precipProbability)}% ${data.weather.precipType || "precip"}`}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-muted-foreground">
          {new Date(data.generatedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/New_York",
          })}
        </p>
      </div>
    </div>
  );
}
