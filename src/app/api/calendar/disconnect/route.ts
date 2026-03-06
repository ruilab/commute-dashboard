import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendarConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(calendarConnections)
    .where(eq(calendarConnections.userId, session.user.id));

  return NextResponse.json({ ok: true });
}
