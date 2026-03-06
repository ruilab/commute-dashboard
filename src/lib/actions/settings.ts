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
    // Create default settings
    const [created] = await db
      .insert(userSettings)
      .values({ userId: session.user.id })
      .returning();
    return created;
  }

  return settings;
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
