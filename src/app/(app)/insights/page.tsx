import { Suspense } from "react";
import { InsightsContent } from "@/components/insights/insights-content";

export default function InsightsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">Commute analytics</p>
      </header>
      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        }
      >
        <InsightsContent />
      </Suspense>
    </div>
  );
}
