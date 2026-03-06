"use client";

import { useState, useTransition } from "react";

interface Props {
  requireCode: boolean;
  onSignIn: (code?: string) => Promise<void>;
}

export function SignInForm({ requireCode, onSignIn }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError("");
    startTransition(async () => {
      try {
        await onSignIn(requireCode ? code : undefined);
      } catch {
        setError("Invalid signup code. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {requireCode && (
        <div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter signup code"
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-sm placeholder:text-muted-foreground"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending || (requireCode && !code.trim())}
        className="tap-target w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Redirecting..." : "Sign in with GitHub"}
      </button>

      <p className="text-xs text-muted-foreground">
        {requireCode
          ? "Need a code? Reach out to @chenrui333 on GitHub."
          : "Sign in with your GitHub account to get started."}
      </p>
    </div>
  );
}
