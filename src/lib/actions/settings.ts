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
  const settings = await getSettings();
  return settings?.onboardingCompletedAt !== null && settings?.onboardingCompletedAt !== undefined;
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

  const existing = await getSettings();

  if (existing) {
    await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, session.user.id));
  } else {
    await db.insert(userSettings).values({
      userId: session.user.id,
      ...data,
    });
  }
}

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

  await updateSettings({
    preferredMode: data.preferredMode,
    commuteDays: data.commuteDays,
    customDays: data.customDays,
    activeRoutes: data.activeRoutes,
    walkHomeToJsq: data.walkHomeToJsq,
    walkWtcToOffice: data.walkWtcToOffice,
    walkOfficeToWtc: data.walkOfficeToWtc,
    walkJsqToHome: data.walkJsqToHome,
    morningWindowStart: data.morningWindowStart,
    morningWindowEnd: data.morningWindowEnd,
    eveningWindowStart: data.eveningWindowStart,
    eveningWindowEnd: data.eveningWindowEnd,
    pushEnabled: data.pushEnabled,
    activeRoute: data.activeRoutes[0],
    onboardingCompletedAt: new Date(),
  });

  const [existingProfile] = await db
    .select({ id: commuterProfiles.id })
    .from(commuterProfiles)
    .where(eq(commuterProfiles.userId, session.user.id))
    .limit(1);

  const commuterProfilePayload = {
    homeArea: data.homeArea.trim() || null,
    officeArea: data.officeArea.trim() || null,
    preferredModes: normalizePreferredModes(data.preferredModes, data.preferredMode),
    riskTolerance: data.riskTolerance,
    reliabilityPref: data.reliabilityPref,
    updatedAt: new Date(),
  };

  if (existingProfile) {
    await db
      .update(commuterProfiles)
      .set(commuterProfilePayload)
      .where(eq(commuterProfiles.userId, session.user.id));
    return;
  }

  await db.insert(commuterProfiles).values({
    userId: session.user.id,
    ...commuterProfilePayload,
  });
}
