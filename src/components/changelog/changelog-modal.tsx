"use client";

import { useState, useEffect, useTransition } from "react";
import { getUnseenChangelog, markChangelogSeen } from "@/lib/actions/changelog";

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  body: string;
  category: string;
  publishedAt: Date;
}

const CATEGORY_ICONS: Record<string, string> = {
  feature: "✨",
  improvement: "🔧",
  fix: "🐛",
  data: "📊",
};

export function ChangelogBanner() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [show, setShow] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getUnseenChangelog().then(({ entries, hasUnseen }) => {
      if (hasUnseen && entries.length > 0) {
        setEntries(entries);
        setShow(true);
      }
    }).catch(() => {});
  }, []);

  const handleDismiss = () => {
    setShow(false);
    startTransition(async () => {
      await markChangelogSeen();
    });
  };

  if (!show || entries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">What&apos;s New</h2>
          <button
            onClick={handleDismiss}
            className="tap-target rounded-lg px-3 py-1 text-sm text-muted-foreground hover:bg-secondary"
          >
            Got it
          </button>
        </div>

        <div className="max-h-80 space-y-4 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span>{CATEGORY_ICONS[entry.category] || "📋"}</span>
                <span className="font-medium text-sm">{entry.title}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {entry.version}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {entry.body}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={handleDismiss}
          className="tap-target mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
