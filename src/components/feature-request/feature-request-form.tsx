"use client";

import { useState, useTransition } from "react";

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "transit", label: "Transit Data" },
  { id: "ux", label: "UX / Mobile" },
  { id: "notifications", label: "Notifications" },
  { id: "insights", label: "Insights" },
];

interface SubmitResult {
  ok?: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}

export function FeatureRequestForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const titleValid = title.trim().length >= 3;
  const descValid = description.trim().length >= 10;
  const canSubmit = titleValid && descValid && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setResult(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/feature-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
        });

        const data = await res.json();

        if (res.ok && data.ok) {
          setResult(data);
          setTitle("");
          setDescription("");
          setCategory("general");
        } else {
          setResult({ error: data.error || `Error ${res.status}` });
        }
      } catch {
        setResult({ error: "Network error — please try again" });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Success */}
      {result?.ok && (
        <div className="rounded-xl bg-success/10 p-4">
          <p className="font-medium text-success">Request submitted!</p>
          {result.issueUrl && (
            <a
              href={result.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm text-primary underline"
            >
              View issue #{result.issueNumber} on GitHub →
            </a>
          )}
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div className="rounded-xl bg-danger/10 p-4">
          <p className="text-sm text-danger">{result.error}</p>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="mb-2 block text-sm font-medium">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                category === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary of your request"
          maxLength={200}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground"
        />
        {title.length > 0 && !titleValid && (
          <p className="mt-1 text-xs text-danger">At least 3 characters</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you'd like and why it would help your commute..."
          maxLength={2000}
          rows={5}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          {description.length > 0 && !descValid ? (
            <span className="text-danger">At least 10 characters</span>
          ) : (
            <span />
          )}
          <span>{description.length}/2000</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="tap-target w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-colors disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit Feature Request"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        This will create a GitHub issue in the project repository.
      </p>
    </div>
  );
}
