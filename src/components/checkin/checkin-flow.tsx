"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startSession,
  addEvent,
  addTag,
} from "@/lib/actions/commute";
import type { Direction, EventStep } from "@/lib/db/schema";

interface ActiveSession {
  session: {
    id: string;
    direction: Direction;
    startedAt: Date;
  };
  events: { step: string; timestamp: Date }[];
  tags: { tag: string; note: string | null }[];
}

const OUTBOUND_STEPS: { step: EventStep; label: string; icon: string }[] = [
  { step: "start_commute", label: "Left home", icon: "🏠" },
  { step: "reached_station", label: "At JSQ station", icon: "🚉" },
  { step: "boarded_train", label: "On train", icon: "🚇" },
  { step: "arrived_wtc", label: "Arrived WTC", icon: "🏙️" },
  { step: "arrived_destination", label: "At office", icon: "🏢" },
];

const RETURN_STEPS: { step: EventStep; label: string; icon: string }[] = [
  { step: "start_commute", label: "Left office", icon: "🏢" },
  { step: "reached_station", label: "At WTC station", icon: "🚉" },
  { step: "boarded_train", label: "On train", icon: "🚇" },
  { step: "arrived_jsq", label: "Arrived JSQ", icon: "🚉" },
  { step: "arrived_destination", label: "Home", icon: "🏠" },
];

const QUICK_TAGS = [
  { tag: "path_delay", label: "PATH delay", icon: "⏰" },
  { tag: "crowded", label: "Crowded", icon: "👥" },
  { tag: "missed_train", label: "Missed train", icon: "🏃" },
  { tag: "bad_weather", label: "Bad weather", icon: "🌧️" },
  { tag: "slow_walking", label: "Slow walking", icon: "🚶" },
];

export function CheckinFlow({
  activeSession,
}: {
  activeSession: ActiveSession | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addedTags, setAddedTags] = useState<string[]>(
    activeSession?.tags.map((t) => t.tag) ?? []
  );

  const handleStartSession = (direction: Direction) => {
    startTransition(async () => {
      await startSession(direction);
      router.refresh();
    });
  };

  const handleAddEvent = (step: EventStep) => {
    if (!activeSession) return;
    startTransition(async () => {
      await addEvent(activeSession.session.id, step);
      router.refresh();
    });
  };

  const handleAddTag = (tag: string) => {
    if (!activeSession || addedTags.includes(tag)) return;
    startTransition(async () => {
      await addTag(activeSession.session.id, tag);
      setAddedTags((prev) => [...prev, tag]);
    });
  };

  // No active session: show start buttons
  if (!activeSession) {
    return (
      <div className="space-y-4">
        <p className="text-center text-muted-foreground">
          No active commute. Start one:
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleStartSession("outbound")}
            disabled={isPending}
            className="tap-target flex flex-col items-center gap-2 rounded-xl bg-card p-6 shadow-sm transition-colors active:bg-secondary disabled:opacity-50"
          >
            <span className="text-3xl">🌅</span>
            <span className="font-medium">To Office</span>
            <span className="text-xs text-muted-foreground">
              Home → JSQ → WTC
            </span>
          </button>
          <button
            onClick={() => handleStartSession("return")}
            disabled={isPending}
            className="tap-target flex flex-col items-center gap-2 rounded-xl bg-card p-6 shadow-sm transition-colors active:bg-secondary disabled:opacity-50"
          >
            <span className="text-3xl">🌆</span>
            <span className="font-medium">To Home</span>
            <span className="text-xs text-muted-foreground">
              WTC → JSQ → Home
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Active session: show step progress
  const steps =
    activeSession.session.direction === "outbound"
      ? OUTBOUND_STEPS
      : RETURN_STEPS;
  const completedSteps = new Set(activeSession.events.map((e) => e.step));
  const nextStepIdx = steps.findIndex((s) => !completedSteps.has(s.step));

  return (
    <div className="space-y-6">
      {/* Direction indicator */}
      <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {activeSession.session.direction === "outbound" ? "🌅" : "🌆"}
          </span>
          <span className="font-medium capitalize">
            {activeSession.session.direction === "outbound"
              ? "To Office"
              : "To Home"}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          Started{" "}
          {new Date(activeSession.session.startedAt).toLocaleTimeString(
            "en-US",
            { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }
          )}
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.has(step.step);
          const isNext = idx === nextStepIdx;
          const event = activeSession.events.find(
            (e) => e.step === step.step
          );

          return (
            <button
              key={step.step}
              onClick={() => handleAddEvent(step.step)}
              disabled={isPending || isCompleted || !isNext}
              className={`tap-target flex w-full items-center gap-4 rounded-xl p-4 text-left transition-all ${
                isCompleted
                  ? "bg-success/5 border border-success/20"
                  : isNext
                    ? "bg-primary/5 border-2 border-primary shadow-sm"
                    : "bg-muted/50 border border-transparent opacity-50"
              } disabled:cursor-default`}
            >
              <span className="text-2xl">{step.icon}</span>
              <div className="flex-1">
                <p className={`font-medium ${isCompleted ? "text-success" : ""}`}>
                  {step.label}
                </p>
                {event && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                      timeZone: "America/New_York",
                    })}
                  </p>
                )}
              </div>
              {isCompleted && <span className="text-success text-xl">✓</span>}
              {isNext && (
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Tap
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Tags */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Quick tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_TAGS.map((qt) => {
            const isAdded = addedTags.includes(qt.tag);
            return (
              <button
                key={qt.tag}
                onClick={() => handleAddTag(qt.tag)}
                disabled={isPending || isAdded}
                className={`tap-target rounded-full px-3 py-2 text-sm transition-colors ${
                  isAdded
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-secondary-foreground active:bg-primary/10"
                }`}
              >
                {qt.icon} {qt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Completed indicator */}
      {nextStepIdx === -1 && (
        <div className="rounded-xl bg-success/10 p-4 text-center">
          <p className="text-lg font-medium text-success">
            Commute complete! 🎉
          </p>
          <p className="text-sm text-muted-foreground">
            Duration:{" "}
            {Math.round(
              (Date.now() -
                new Date(activeSession.session.startedAt).getTime()) /
                1000 /
                60
            )}{" "}
            min
          </p>
        </div>
      )}
    </div>
  );
}
