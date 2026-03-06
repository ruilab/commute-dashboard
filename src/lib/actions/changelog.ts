"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { changelogEntries, userChangelogSeen } from "@/lib/db/schema";
import { eq, desc, gt } from "drizzle-orm";

export async function getUnseenChangelog() {
  const session = await auth();
  if (!session?.user?.id) return { entries: [], hasUnseen: false };

  // Get user's last seen timestamp
  const [seen] = await db
    .select()
    .from(userChangelogSeen)
    .where(eq(userChangelogSeen.userId, session.user.id))
    .limit(1);

  const lastSeenAt = seen?.lastSeenAt ?? new Date(0);

  // Get entries newer than last seen
  const entries = await db
    .select()
    .from(changelogEntries)
    .where(gt(changelogEntries.publishedAt, lastSeenAt))
    .orderBy(desc(changelogEntries.publishedAt))
    .limit(20);

  return { entries, hasUnseen: entries.length > 0 };
}

export async function getAllChangelog() {
  return db
    .select()
    .from(changelogEntries)
    .orderBy(desc(changelogEntries.publishedAt))
    .limit(50);
}

export async function markChangelogSeen() {
  const session = await auth();
  if (!session?.user?.id) return;

  const [existing] = await db
    .select()
    .from(userChangelogSeen)
    .where(eq(userChangelogSeen.userId, session.user.id))
    .limit(1);

  if (existing) {
    await db
      .update(userChangelogSeen)
      .set({ lastSeenAt: new Date() })
      .where(eq(userChangelogSeen.userId, session.user.id));
  } else {
    await db.insert(userChangelogSeen).values({
      userId: session.user.id,
      lastSeenAt: new Date(),
    });
  }
}
