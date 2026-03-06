"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
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
}) {
  await updateSettings({
    ...data,
    activeRoute: data.activeRoutes[0],
    onboardingCompletedAt: new Date(),
  });
}
