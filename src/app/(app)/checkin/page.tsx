import { CheckinFlow } from "@/components/checkin/checkin-flow";
import { getActiveSession } from "@/lib/actions/commute";
import { getSettings } from "@/lib/actions/settings";

export default async function CheckinPage() {
  const [active, settings] = await Promise.all([
    getActiveSession(),
    getSettings(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Check-in</h1>
        <p className="text-sm text-muted-foreground">Track your commute</p>
      </header>
      <CheckinFlow
        activeSession={active}
        mode={settings?.preferredMode ?? "subway"}
      />
    </div>
  );
}
