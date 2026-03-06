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
};

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

  return (
    <div className="space-y-6">
      {/* Walking times */}
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-medium">Walking Times</h3>
        <div className="space-y-3">
          <NumberInput
            label="Home → JSQ"
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
            label="JSQ → Home"
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
