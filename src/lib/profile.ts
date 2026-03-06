const PROFILE_MODE_ORDER = ["path", "subway", "bus", "commuter_rail", "ferry"] as const;

type ProfileMode = (typeof PROFILE_MODE_ORDER)[number];

const PROFILE_MODE_SET = new Set<string>(PROFILE_MODE_ORDER);

function fallbackMode(preferredMode: string): ProfileMode {
  return preferredMode === "ferry" ? "ferry" : "path";
}

export function normalizePreferredModes(
  preferredModes: string[] | undefined,
  preferredMode: string
): ProfileMode[] {
  const deduped = Array.from(
    new Set((preferredModes ?? []).filter((mode): mode is ProfileMode => PROFILE_MODE_SET.has(mode)))
  );

  if (deduped.length > 0) return deduped;
  return [fallbackMode(preferredMode)];
}
