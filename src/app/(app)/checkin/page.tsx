import { CheckinFlow } from "@/components/checkin/checkin-flow";
import { getActiveSession } from "@/lib/actions/commute";

export default async function CheckinPage() {
  const active = await getActiveSession();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Check-in</h1>
        <p className="text-sm text-muted-foreground">Track your commute</p>
      </header>
      <CheckinFlow activeSession={active} />
    </div>
  );
}
