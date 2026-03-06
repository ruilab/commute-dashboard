"use client";

import { useState, useTransition } from "react";
import { updateSettings } from "@/lib/actions/settings";

interface SettingsData {
  walkHomeToJsq: number;
  walkWtcToOffice: number;
  walkOfficeToWtc: number;
  walkJsqToHome: number;
  morningWindowStart: string;
  morningWindowEnd: string;
  eveningWindowStart: string;
  eveningWindowEnd: string;
  pushEnabled: boolean;
  pushLeaveReminder: boolean;
  pushServiceAlert: boolean;
  pushWeatherAlert: boolean;
  activeRoute: string;
}

const DEFAULTS: SettingsData = {
  walkHomeToJsq: 8,
  walkWtcToOffice: 10,
  walkOfficeToWtc: 10,
  walkJsqToHome: 8,
  morningWindowStart: "08:30",
  morningWindowEnd: "10:00",
  eveningWindowStart: "19:00",
  eveningWindowEnd: "21:00",
  pushEnabled: false,
  pushLeaveReminder: true,
  pushServiceAlert: true,
  pushWeatherAlert: false,
  activeRoute: "JSQ-WTC",
};

const ROUTES = [
  { id: "JSQ-WTC", label: "JSQ ↔ WTC" },
  { id: "JSQ-33", label: "JSQ ↔ 33rd St" },
  { id: "HOB-WTC", label: "Hoboken ↔ WTC" },
  { id: "HOB-33", label: "Hoboken ↔ 33rd St" },
];

function NumberInput({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={60}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-border"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsForm({
  settings,
}: {
  settings: SettingsData | null;
}) {
  const [data, setData] = useState<SettingsData>(settings || DEFAULTS);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const update = (partial: Partial<SettingsData>) => {
    setData((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const handleEnablePush = async () => {
    if (!("Notification" in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    if (Notification.permission === "denied") {
      alert(
        "Notifications are blocked. Enable them in your browser settings."
      );
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          update({ pushEnabled: true });
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });

        update({ pushEnabled: true });
      }
    } catch {
      alert("Failed to enable push notifications.");
    }
  };

  const handleDisablePush = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsubscribe" }),
      });
    } catch {
      // Continue anyway
    }

    update({ pushEnabled: false });
  };

  return (
    <div className="space-y-6">
      {/* Route selection */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-medium">Route</h3>
        <div className="grid grid-cols-2 gap-2">
          {ROUTES.map((route) => (
            <button
              key={route.id}
              onClick={() => update({ activeRoute: route.id })}
              className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                data.activeRoute === route.id
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border"
              }`}
            >
              {route.label}
            </button>
          ))}
        </div>
      </div>

      {/* Walking times */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-medium">Walking Times</h3>
        <div className="space-y-3">
          <NumberInput
            label="Home → Station"
            value={data.walkHomeToJsq}
            onChange={(v) => update({ walkHomeToJsq: v })}
            unit="min"
          />
          <NumberInput
            label="WTC → Office"
            value={data.walkWtcToOffice}
            onChange={(v) => update({ walkWtcToOffice: v })}
            unit="min"
          />
          <NumberInput
            label="Office → WTC"
            value={data.walkOfficeToWtc}
            onChange={(v) => update({ walkOfficeToWtc: v })}
            unit="min"
          />
          <NumberInput
            label="Station → Home"
            value={data.walkJsqToHome}
            onChange={(v) => update({ walkJsqToHome: v })}
            unit="min"
          />
        </div>
      </div>

      {/* Decision windows */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-medium">Decision Windows</h3>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Morning</p>
          <TimeInput
            label="From"
            value={data.morningWindowStart}
            onChange={(v) => update({ morningWindowStart: v })}
          />
          <TimeInput
            label="To"
            value={data.morningWindowEnd}
            onChange={(v) => update({ morningWindowEnd: v })}
          />
          <div className="my-2 border-t border-border" />
          <p className="text-xs text-muted-foreground">Evening</p>
          <TimeInput
            label="From"
            value={data.eveningWindowStart}
            onChange={(v) => update({ eveningWindowStart: v })}
          />
          <TimeInput
            label="To"
            value={data.eveningWindowEnd}
            onChange={(v) => update({ eveningWindowEnd: v })}
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-medium">Notifications</h3>
        <div className="space-y-4">
          <Toggle
            label="Push notifications"
            description="Get alerts on your phone"
            checked={data.pushEnabled}
            onChange={(v) => (v ? handleEnablePush() : handleDisablePush())}
          />
          {data.pushEnabled && (
            <>
              <Toggle
                label="Leave reminder"
                description="Remind me when it's time to leave"
                checked={data.pushLeaveReminder}
                onChange={(v) => update({ pushLeaveReminder: v })}
              />
              <Toggle
                label="Service alerts"
                description="PATH delays and suspensions"
                checked={data.pushServiceAlert}
                onChange={(v) => update({ pushServiceAlert: v })}
              />
              <Toggle
                label="Weather alerts"
                description="Severe weather affecting commute"
                checked={data.pushWeatherAlert}
                onChange={(v) => update({ pushWeatherAlert: v })}
              />
            </>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className={`tap-target w-full rounded-xl py-3 font-medium transition-colors ${
          saved
            ? "bg-success/10 text-success"
            : "bg-primary text-primary-foreground"
        } disabled:opacity-50`}
      >
        {isPending ? "Saving..." : saved ? "Saved ✓" : "Save Settings"}
      </button>
    </div>
  );
}
