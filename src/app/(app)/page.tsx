import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { isOnboardingComplete } from "@/lib/actions/settings";

export default async function DashboardPage() {
  const onboarded = await isOnboardingComplete();
  if (!onboarded) redirect("/onboarding");

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Commute Dashboard</h1>
          <p className="text-sm text-muted-foreground">JSQ ↔ WTC</p>
        </div>
      </header>
      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}
