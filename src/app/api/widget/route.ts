import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/actions/dashboard";
import { NextResponse } from "next/server";

/**
 * JSON API endpoint for widget / automation consumption.
 * Returns the current recommendation in a minimal format.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getDashboardData();

    // Determine which recommendation is most relevant right now
    const now = new Date();
    const hour = now.getHours();
    const isEvening = hour >= 15; // After 3 PM, show evening rec

    const activeRec = isEvening ? data.eveningRec : data.morningRec;
    const direction = isEvening ? "return" : "outbound";

    return NextResponse.json({
      direction,
      bestBand: activeRec.bestBand,
      fallbacks: activeRec.fallbackBands,
      confidence: activeRec.confidence,
      explanation: activeRec.explanation,
      estimatedMinutes: activeRec.estimatedMinutes,
      transit: {
        status: data.transit.status,
        advisory: data.transit.advisoryText,
      },
      weather: {
        condition: data.weather.condition,
        temperature: data.weather.temperature,
        precipProbability: data.weather.precipProbability,
      },
      generatedAt: data.generatedAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate recommendation" },
      { status: 500 }
    );
  }
}
