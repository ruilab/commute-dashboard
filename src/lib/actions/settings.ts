"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { commuterProfiles, userSettings } from "@/lib/db/schema";
import { normalizePreferredModes } from "@/lib/profile";
import { eq } from "drizzle-orm";

export async function getSettings() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  if (!settings) {
    const [created] = await db
      .insert(userSettings)
      .values({ userId: session.user.id })
      .returning();
    return created;
  }

  return settings;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  // Direct query — no getSettings() indirection
  const [row] = await db
    .select({ ts: userSettings.onboardingCompletedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  return row?.ts !== null && row?.ts !== undefined;
}

export async function updateSettings(data: {
  walkHomeToJsq?: number;
  walkWtcToOffice?: number;
  walkOfficeToWtc?: number;
  walkJsqToHome?: number;
  morningWindowStart?: string;
  morningWindowEnd?: string;
  eveningWindowStart?: string;
  eveningWindowEnd?: string;
  pushEnabled?: boolean;
  pushLeaveReminder?: boolean;
  pushServiceAlert?: boolean;
  pushWeatherAlert?: boolean;
  activeRoute?: string;
  activeRoutes?: string[];
  preferredMode?: string;
  commuteDays?: string;
  customDays?: number[];
  onboardingCompletedAt?: Date;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Single upsert — try update first, insert if no rows affected
  const updated = await db
    .update(userSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userSettings.userId, session.user.id))
    .returning({ id: userSettings.id });

  if (updated.length === 0) {
    await db.insert(userSettings).values({
      userId: session.user.id,
      ...data,
    });
  }
}

/**
 * Complete onboarding in minimal DB round-trips.
 * Single auth() call, parallel settings + profile writes.
 */
export async function completeOnboarding(data: {
  preferredMode: string;
  commuteDays: string;
  customDays?: number[];
  activeRoutes: string[];
  walkHomeToJsq: number;
  walkWtcToOffice: number;
  walkOfficeToWtc: number;
  walkJsqToHome: number;
  morningWindowStart: string;
  morningWindowEnd: string;
  eveningWindowStart: string;
  eveningWindowEnd: string;
  pushEnabled: boolean;
  homeArea: string;
  officeArea: string;
  preferredModes: string[];
  riskTolerance: "conservative" | "moderate" | "aggressive";
  reliabilityPref: "fastest" | "most_reliable" | "least_crowded";
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const userId = session.user.id;
  const now = new Date();

  const settingsPayload = {
    preferredMode: data.preferredMode,
    commuteDays: data.commuteDays,
    customDays: data.customDays,
    activeRoutes: data.activeRoutes,
    activeRoute: data.activeRoutes[0],
    walkHomeToJsq: data.walkHomeToJsq,
    walkWtcToOffice: data.walkWtcToOffice,
    walkOfficeToWtc: data.walkOfficeToWtc,
    walkJsqToHome: data.walkJsqToHome,
    morningWindowStart: data.morningWindowStart,
    morningWindowEnd: data.morningWindowEnd,
    eveningWindowStart: data.eveningWindowStart,
    eveningWindowEnd: data.eveningWindowEnd,
    pushEnabled: data.pushEnabled,
    onboardingCompletedAt: now,
    updatedAt: now,
  };

  const profilePayload = {
    homeArea: data.homeArea.trim() || null,
    officeArea: data.officeArea.trim() || null,
    preferredModes: normalizePreferredModes(data.preferredModes, data.preferredMode),
    riskTolerance: data.riskTolerance,
    reliabilityPref: data.reliabilityPref,
    updatedAt: now,
  };

  // Run settings upsert + profile upsert in parallel
  await Promise.all([
    // Settings: try update, fall back to insert
    db
      .update(userSettings)
      .set(settingsPayload)
      .where(eq(userSettings.userId, userId))
      .returning({ id: userSettings.id })
      .then((rows) => {
        if (rows.length === 0) {
          return db.insert(userSettings).values({ userId, ...settingsPayload });
        }
      }),
    // Profile: try update, fall back to insert
    db
      .update(commuterProfiles)
      .set(profilePayload)
      .where(eq(commuterProfiles.userId, userId))
      .returning({ id: commuterProfiles.id })
      .then((rows) => {
        if (rows.length === 0) {
          return db.insert(commuterProfiles).values({ userId, ...profilePayload });
        }
      }),
  ]);
}
