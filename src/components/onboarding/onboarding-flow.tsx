"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/actions/settings";

const MODES = [
  { id: "subway", label: "Subway (PATH)", icon: "🚇", desc: "PATH train service" },
  { id: "ferry", label: "Ferry", icon: "⛴️", desc: "NYC Ferry / NJ Waterway", disabled: true, disabledReason: "Coming soon" },
];

const DAY_OPTIONS = [
  { id: "weekdays", label: "Mon–Fri", desc: "Standard work week" },
  { id: "all", label: "Every day", desc: "Including weekends" },
];

const SUBWAY_ROUTES = [
  { id: "JSQ-WTC", label: "JSQ ↔ WTC", time: "~13 min" },
  { id: "JSQ-33", label: "JSQ ↔ 33rd St", time: "~25 min" },
  { id: "HOB-WTC", label: "Hoboken ↔ WTC", time: "~15 min" },
  { id: "HOB-33", label: "Hoboken ↔ 33rd St", time: "~18 min" },
];

interface OnboardingState {
  step: number;
  mode: string;
  days: string;
  routes: string[];
  walkHomeToStation: number;
  walkStationToOffice: number;
  walkOfficeToStation: number;
  walkStationToHome: number;
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
  pushEnabled: boolean;
}

export function OnboardingFlow() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    mode: "subway",
    days: "weekdays",
    routes: ["JSQ-WTC"],
    walkHomeToStation: 8,
    walkStationToOffice: 10,
    walkOfficeToStation: 10,
    walkStationToHome: 8,
    morningStart: "08:30",
    morningEnd: "10:00",
    eveningStart: "19:00",
    eveningEnd: "21:00",
    pushEnabled: false,
  });

  const STEPS = ["Mode & Schedule", "Route", "Walking Times", "Time Windows", "Review"];
  const totalSteps = STEPS.length;

  const update = (partial: Partial<OnboardingState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  const next = () => update({ step: Math.min(state.step + 1, totalSteps - 1) });
  const back = () => update({ step: Math.max(state.step - 1, 0) });

  const handleComplete = () => {
    startTransition(async () => {
      await completeOnboarding({
        preferredMode: state.mode,
        commuteDays: state.days,
        activeRoutes: state.routes,
        walkHomeToJsq: state.walkHomeToStation,
        walkWtcToOffice: state.walkStationToOffice,
        walkOfficeToWtc: state.walkOfficeToStation,
        walkJsqToHome: state.walkStationToHome,
        morningWindowStart: state.morningStart,
        morningWindowEnd: state.morningEnd,
        eveningWindowStart: state.eveningStart,
        eveningWindowEnd: state.eveningEnd,
        pushEnabled: state.pushEnabled,
      });
      router.push("/");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Set up your commute</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {state.step + 1} of {totalSteps} — {STEPS[state.step]}
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${((state.step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 0: Mode & Schedule */}
      {state.step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-medium">How do you commute?</h2>
            <div className="grid grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => !m.disabled && update({ mode: m.id })}
                  disabled={m.disabled}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    state.mode === m.id
                      ? "border-primary bg-primary/5"
                      : m.disabled
                        ? "border-border opacity-40"
                        : "border-border"
                  }`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <p className="mt-1 text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.disabled ? m.disabledReason : m.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-medium">Which days?</h2>
            <div className="grid grid-cols-2 gap-3">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => update({ days: d.id })}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    state.days === d.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Route */}
      {state.step === 1 && (
        <div>
          <h2 className="mb-3 font-medium">Select your route(s)</h2>
          <div className="space-y-2">
            {SUBWAY_ROUTES.map((r) => {
              const active = state.routes.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    if (active && state.routes.length > 1) {
                      update({ routes: state.routes.filter((x) => x !== r.id) });
                    } else if (!active) {
                      update({ routes: [...state.routes, r.id] });
                    }
                  }}
                  className={`tap-target flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.time}</p>
                  </div>
                  {active && <span className="text-primary text-lg">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Walking times */}
      {state.step === 2 && (
        <div className="space-y-4">
          <h2 className="font-medium">Walking times (minutes)</h2>
          {[
            { label: "Home → Station", key: "walkHomeToStation" as const },
            { label: "Station → Office", key: "walkStationToOffice" as const },
            { label: "Office → Station", key: "walkOfficeToStation" as const },
            { label: "Station → Home", key: "walkStationToHome" as const },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update({ [key]: Math.max(1, state[key] - 1) })}
                  className="tap-target flex h-10 w-10 items-center justify-center rounded-lg border border-border text-lg"
                >
                  −
                </button>
                <span className="w-10 text-center font-medium">{state[key]}</span>
                <button
                  onClick={() => update({ [key]: Math.min(60, state[key] + 1) })}
                  className="tap-target flex h-10 w-10 items-center justify-center rounded-lg border border-border text-lg"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 3: Time windows + notifications */}
      {state.step === 3 && (
        <div className="space-y-4">
          <h2 className="font-medium">Morning departure window</h2>
          <div className="flex items-center gap-4">
            <input
              type="time"
              value={state.morningStart}
              onChange={(e) => update({ morningStart: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="time"
              value={state.morningEnd}
              onChange={(e) => update({ morningEnd: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <h2 className="font-medium">Evening return window</h2>
          <div className="flex items-center gap-4">
            <input
              type="time"
              value={state.eveningStart}
              onChange={(e) => update({ eveningStart: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="time"
              value={state.eveningEnd}
              onChange={(e) => update({ eveningEnd: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground">Departure reminders + alerts</p>
            </div>
            <button
              onClick={() => update({ pushEnabled: !state.pushEnabled })}
              className={`relative h-6 w-11 rounded-full transition-colors ${state.pushEnabled ? "bg-primary" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${state.pushEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {state.step === 4 && (
        <div className="space-y-4">
          <h2 className="font-medium">Review your setup</h2>
          <div className="space-y-3 rounded-xl bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-medium">{state.mode === "subway" ? "🚇 Subway" : "⛴️ Ferry"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Days</span>
              <span className="font-medium">{state.days === "weekdays" ? "Mon–Fri" : "Every day"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Route(s)</span>
              <span className="font-medium">{state.routes.join(", ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Morning</span>
              <span className="font-medium">{state.morningStart}–{state.morningEnd}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Evening</span>
              <span className="font-medium">{state.eveningStart}–{state.eveningEnd}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Walking</span>
              <span className="font-medium">
                {state.walkHomeToStation}+{state.walkStationToOffice} / {state.walkOfficeToStation}+{state.walkStationToHome} min
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Notifications</span>
              <span className="font-medium">{state.pushEnabled ? "On" : "Off"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {state.step > 0 && (
          <button
            onClick={back}
            className="tap-target flex-1 rounded-xl border border-border py-3 font-medium transition-colors"
          >
            Back
          </button>
        )}
        {state.step < totalSteps - 1 ? (
          <button
            onClick={next}
            className="tap-target flex-1 rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={isPending}
            className="tap-target flex-1 rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-colors disabled:opacity-50"
          >
            {isPending ? "Setting up..." : "Start commuting"}
          </button>
        )}
      </div>
    </div>
  );
}
