import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/lib/actions/settings";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const params = await searchParams;
  const isReset = params.reset === "1";
  if (!isReset) {
    const complete = await isOnboardingComplete();
    if (complete) redirect("/");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <OnboardingFlow />
    </div>
  );
}
