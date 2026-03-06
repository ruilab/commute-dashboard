import { Suspense } from "react";
import { HistoryList } from "@/components/history/history-list";

export default function HistoryPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">Recent commutes</p>
      </header>
      <Suspense
        fallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        }
      >
        <HistoryList />
      </Suspense>
    </div>
  );
}
