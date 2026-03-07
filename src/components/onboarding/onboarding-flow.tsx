"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/actions/settings";

type PreferredMode = "path" | "subway" | "bus" | "commuter_rail" | "ferry";
type RiskTolerance = "conservative" | "moderate" | "aggressive";
type ReliabilityPref = "fastest" | "most_reliable" | "least_crowded";

const MODES: { id: string; label: string; icon: string; desc: string; disabled?: boolean; disabledReason?: string }[] = [
  { id: "subway", label: "Subway (PATH)", icon: "🚇", desc: "PATH train service" },
  { id: "ferry", label: "Ferry", icon: "⛴️", desc: "NYC Ferry / NJ Waterway" },
];

const HOME_AREAS = [
  "Jersey City Heights",
  "Downtown Jersey City",
  "Hoboken",
  "Astoria",
  "Stamford",
  "Other NYC/NJ/CT",
];

const OFFICE_AREAS = ["WTC", "Midtown 33rd", "FiDi", "Hudson Yards", "Other"];

const PREFERRED_MODES: { id: PreferredMode; label: string; desc: string; disabled?: boolean }[] = [
  { id: "path", label: "PATH", desc: "Best for Jersey City/Hoboken ↔ Manhattan" },
  { id: "subway", label: "MTA Subway", desc: "Useful if you transfer after PATH" },
  { id: "bus", label: "Bus", desc: "NJT or MTA surface options", disabled: true },
  { id: "commuter_rail", label: "Commuter Rail", desc: "NJT, LIRR, Metro-North", disabled: true },
  { id: "ferry", label: "Ferry", desc: "NYC Ferry and NJ Waterway" },
];

const RISK_OPTIONS: { id: RiskTolerance; label: string; desc: string }[] = [
  { id: "conservative", label: "Conservative", desc: "Leave earlier, maximize on-time arrival" },
  { id: "moderate", label: "Moderate", desc: "Balanced buffer and total trip time" },
  { id: "aggressive", label: "Aggressive", desc: "Leave later, accept more timing risk" },
];

const RELIABILITY_OPTIONS: { id: ReliabilityPref; label: string; desc: string }[] = [
  { id: "fastest", label: "Fastest average", desc: "Prioritize lowest expected travel time" },
  { id: "most_reliable", label: "Most reliable", desc: "Prioritize stable and predictable arrivals" },
  { id: "least_crowded", label: "Least crowded", desc: "Prefer comfort even if travel is longer" },
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

const FERRY_ROUTES = [
  { id: "HOB-BFP", label: "Hoboken ↔ Brookfield Place", time: "~10 min" },
  { id: "PAU-WFC", label: "Paulus Hook ↔ WFC", time: "~8 min" },
  { id: "HOB-P11", label: "Hoboken ↔ Pier 11/Wall St", time: "~12 min" },
  { id: "LIB-BFP", label: "Liberty Harbor ↔ BFP", time: "~8 min" },
  { id: "LIB-P11", label: "Liberty Harbor ↔ Pier 11", time: "~15 min" },
  { id: "PI-BFP", label: "Port Imperial ↔ BFP", time: "~12 min" },
  { id: "PI-P11", label: "Port Imperial ↔ Pier 11", time: "~25 min" },
  { id: "H14-BFP", label: "Hoboken 14th ↔ BFP", time: "~15 min" },
];

interface OnboardingState {
  step: number;
  mode: string;
  days: string;
  routes: string[];
  homeArea: string;
  officeArea: string;
  preferredModes: PreferredMode[];
  riskTolerance: RiskTolerance;
  reliabilityPref: ReliabilityPref;
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
    homeArea: "Jersey City Heights",
    officeArea: "WTC",
    preferredModes: ["path", "subway"],
    riskTolerance: "moderate",
    reliabilityPref: "fastest",
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

  const STEPS = ["Profile & Schedule", "Route", "Walking Times", "Time Windows", "Review"];
  const totalSteps = STEPS.length;

  const update = (partial: Partial<OnboardingState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  const togglePreferredMode = (mode: PreferredMode) => {
    const selected = state.preferredModes.includes(mode);
    if (selected && state.preferredModes.length === 1) return;

    update({
      preferredModes: selected
        ? state.preferredModes.filter((m) => m !== mode)
        : [...state.preferredModes, mode],
    });
  };

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
        homeArea: state.homeArea,
        officeArea: state.officeArea,
        preferredModes: state.preferredModes,
        riskTolerance: state.riskTolerance,
        reliabilityPref: state.reliabilityPref,
      });
      router.push("/");
      router.refresh();
    });
  };

  const preferredModeLabel = (modeId: PreferredMode) =>
    PREFERRED_MODES.find((mode) => mode.id === modeId)?.label ?? modeId;

  const riskLabel =
    RISK_OPTIONS.find((option) => option.id === state.riskTolerance)?.label ??
    state.riskTolerance;
  const reliabilityLabel =
    RELIABILITY_OPTIONS.find((option) => option.id === state.reliabilityPref)?.label ??
    state.reliabilityPref;

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

      {/* Step 0: Profile + schedule */}
      {state.step === 0 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="font-medium">Where do you commute from and to?</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="home-area" className="text-sm text-muted-foreground">
                  Home area
                </label>
                <select
                  id="home-area"
                  value={state.homeArea}
                  onChange={(e) => update({ homeArea: e.target.value })}
                  className="tap-target w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {HOME_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="office-area" className="text-sm text-muted-foreground">
                  Office location
                </label>
                <select
                  id="office-area"
                  value={state.officeArea}
                  onChange={(e) => update({ officeArea: e.target.value })}
                  className="tap-target w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  {OFFICE_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-medium">How do you commute?</h2>
            <div className="grid grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.disabled) return;
                    const defaultRoutes = m.id === "ferry" ? ["HOB-BFP"] : ["JSQ-WTC"];
                    update({ mode: m.id, routes: defaultRoutes });
                  }}
                  disabled={m.disabled}
                  className={`tap-target rounded-xl border p-4 text-left transition-colors ${
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
                  className={`tap-target rounded-xl border p-4 text-left transition-colors ${
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

          <div>
            <h2 className="mb-3 font-medium">Preferred transit modes</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {PREFERRED_MODES.map((mode) => {
                const selected = state.preferredModes.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    onClick={() => !mode.disabled && togglePreferredMode(mode.id)}
                    disabled={mode.disabled}
                    className={`tap-target rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : mode.disabled
                          ? "border-border opacity-40"
                          : "border-border"
                    }`}
                  >
                    <p className="text-sm font-medium">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {mode.disabled ? "Coming soon" : mode.desc}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Select one or more. Keep PATH selected if you commute from Jersey City or Hoboken.
            </p>
          </div>
        </div>
      )}

      {/* Step 1: Route */}
      {state.step === 1 && (() => {
        const availableRoutes = state.mode === "ferry" ? FERRY_ROUTES : SUBWAY_ROUTES;
        return (
          <div>
            <h2 className="mb-3 font-medium">Select your route(s)</h2>
            {availableRoutes.length > 0 ? (
              <div className="space-y-2">
                {availableRoutes.map((r) => {
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
            ) : (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Route selection for this mode will be available once schedule data is collected.
                You can still proceed — recommendations will use default schedules.
              </div>
            )}
          </div>
        );
      })()}

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
              className="tap-target rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="time"
              value={state.morningEnd}
              onChange={(e) => update({ morningEnd: e.target.value })}
              className="tap-target rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <h2 className="font-medium">Evening return window</h2>
          <div className="flex items-center gap-4">
            <input
              type="time"
              value={state.eveningStart}
              onChange={(e) => update({ eveningStart: e.target.value })}
              className="tap-target rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="time"
              value={state.eveningEnd}
              onChange={(e) => update({ eveningEnd: e.target.value })}
              className="tap-target rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2 pt-2">
            <h2 className="font-medium">Risk tolerance</h2>
            <div className="space-y-2">
              {RISK_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => update({ riskTolerance: option.id })}
                  className={`tap-target w-full rounded-xl border p-3 text-left transition-colors ${
                    state.riskTolerance === option.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-medium">Recommendation preference</h2>
            <div className="space-y-2">
              {RELIABILITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => update({ reliabilityPref: option.id })}
                  className={`tap-target w-full rounded-xl border p-3 text-left transition-colors ${
                    state.reliabilityPref === option.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
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
              <span className="text-muted-foreground">Home area</span>
              <span className="font-medium">{state.homeArea}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Office</span>
              <span className="font-medium">{state.officeArea}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-medium">{state.mode === "subway" ? "🚇 Subway" : "⛴️ Ferry"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Preferred modes</span>
              <span className="font-medium">
                {state.preferredModes.map((modeId) => preferredModeLabel(modeId)).join(", ")}
              </span>
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
              <span className="text-muted-foreground">Risk tolerance</span>
              <span className="font-medium">{riskLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recommendation style</span>
              <span className="font-medium">{reliabilityLabel}</span>
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
