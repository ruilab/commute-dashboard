import { FeatureRequestForm } from "@/components/feature-request/feature-request-form";

export default function FeatureRequestPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Feature Request</h1>
        <p className="text-sm text-muted-foreground">
          Suggest an improvement or new feature
        </p>
      </header>
      <FeatureRequestForm />
    </div>
  );
}
