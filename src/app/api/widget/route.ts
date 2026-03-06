import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/actions/dashboard";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterSec } = checkRateLimit(session.user.id, "widget");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const data = await getDashboardData();
    const now = new Date();
    const hour = now.getHours();
    const isEvening = hour >= 15;
    const activeRec = isEvening ? data.eveningRec : data.morningRec;

    return NextResponse.json({
      direction: isEvening ? "return" : "outbound",
      bestBand: activeRec.bestBand,
      fallbacks: activeRec.fallbackBands,
      confidence: activeRec.confidence,
      explanation: activeRec.explanation,
      estimatedMinutes: activeRec.estimatedMinutes,
      transit: { status: data.transit.status, advisory: data.transit.advisoryText },
      weather: {
        condition: data.weather.condition,
        temperature: data.weather.temperature,
        precipProbability: data.weather.precipProbability,
      },
      generatedAt: data.generatedAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate recommendation" }, { status: 500 });
  }
}
