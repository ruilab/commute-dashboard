"use server";

import { getTransitStatus, getRouteConfig } from "@/lib/services/transit";
import { getWeather } from "@/lib/services/weather";
import { getCalendarContext } from "@/lib/services/calendar";
import { generateRecommendation } from "@/lib/engine/recommend";
import { analyzeCorrelations } from "@/lib/engine/correlation";
import { getSettings } from "@/lib/actions/settings";
import { getHistoricalStats } from "@/lib/actions/commute";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  recommendationSnapshots,
  transitSnapshots,
  weatherSnapshots,
} from "@/lib/db/schema";
import type { Direction } from "@/lib/db/schema";

export async function getDashboardData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const settingsData = await getSettings();
  // v2.5: multi-route support — use activeRoutes array, fallback to activeRoute
  const activeRoutes: string[] =
    settingsData?.activeRoutes && settingsData.activeRoutes.length > 0
      ? settingsData.activeRoutes
      : [settingsData?.activeRoute ?? "JSQ-WTC"];

  const primaryRoute = activeRoutes[0];
  const routeConfig = getRouteConfig(primaryRoute);

  const [transit, weather, outboundStats, returnStats, calendar, correlations] =
    await Promise.all([
      getTransitStatus(primaryRoute),
      getWeather(),
      getHistoricalStats("outbound"),
      getHistoricalStats("return"),
      getCalendarContext(session.user.id).catch(() => null),
      analyzeCorrelations(session.user.id, 60).catch(() => null),
    ]);
  const settings = settingsData;

  const walking = {
    homeToJsq: settings?.walkHomeToJsq ?? 8,
    wtcToOffice: settings?.walkWtcToOffice ?? 10,
    officeToWtc: settings?.walkOfficeToWtc ?? 10,
    jsqToHome: settings?.walkJsqToHome ?? 8,
  };

  // Feed learned penalties from correlation engine
  const learnedPenalties = correlations?.learnedPenalties ?? null;

  let morningWindowEnd = settings?.morningWindowEnd ?? "10:00";
  if (calendar?.mustArriveBy) {
    const [h, m] = calendar.mustArriveBy.split(":").map(Number);
    const arriveByMin = h * 60 + m;
    const trainAndWait = routeConfig.baseTrainTimeMin + 5;
    const walkToStation = walking.homeToJsq;
    const latestDepartMin = arriveByMin - trainAndWait - walkToStation;
    const latestDepart = `${Math.floor(latestDepartMin / 60).toString().padStart(2, "0")}:${(latestDepartMin % 60).toString().padStart(2, "0")}`;
    if (latestDepart < morningWindowEnd) morningWindowEnd = latestDepart;
  }

  const morningRec = generateRecommendation({
    direction: "outbound",
    transit,
    weather,
    walking,
    historical: outboundStats,
    windowStart: settings?.morningWindowStart ?? "08:30",
    windowEnd: morningWindowEnd,
    baseTrainTimeMin: routeConfig.baseTrainTimeMin,
    learnedPenalties,
  });

  const eveningRec = generateRecommendation({
    direction: "return",
    transit,
    weather,
    walking,
    historical: returnStats,
    windowStart: settings?.eveningWindowStart ?? "19:00",
    windowEnd: settings?.eveningWindowEnd ?? "21:00",
    baseTrainTimeMin: routeConfig.baseTrainTimeMin,
    learnedPenalties,
  });

  // Fetch additional routes if multi-route
  const additionalRoutes = await Promise.all(
    activeRoutes.slice(1).map(async (routeId) => {
      const rt = await getTransitStatus(routeId).catch(() => null);
      return rt ? { routeId, status: rt.status, headwayMin: rt.headwayMin } : null;
    })
  );

  persistSnapshots(session.user.id, transit, weather, morningRec, eveningRec).catch(() => {});

  return {
    transit: {
      status: transit.status,
      advisoryText: transit.advisoryText,
      headwayMin: transit.headwayMin,
      isStale: transit.isStale,
      source: transit.source,
      nextArrivals: transit.nextArrivals,
      serviceAlerts: transit.serviceAlerts.map((a) => ({
        description: a.description,
        severity: a.severity,
      })),
      isWeekendSchedule: transit.isWeekendSchedule,
      isPlannedWork: transit.isPlannedWork,
      realHeadwayMin: transit.realHeadwayMin,
    },
    weather: {
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      precipProbability: weather.precipProbability,
      precipType: weather.precipType,
      windSpeed: weather.windSpeed,
      condition: weather.condition,
      isSevere: weather.isSevere,
      forecastHours: weather.forecastHours,
      source: weather.source,
    },
    calendar: calendar
      ? {
          connected: calendar.connected,
          firstMeetingTime: calendar.firstMeetingTime?.toISOString() ?? null,
          firstMeetingTitle: calendar.firstMeetingTitle,
          eventsToday: calendar.eventsToday,
          mustArriveBy: calendar.mustArriveBy,
        }
      : null,
    morningRec: {
      bestBand: morningRec.bestBand.label,
      fallbackBands: morningRec.fallbackBands.map((b) => b.label),
      confidence: morningRec.confidence,
      explanation: morningRec.explanation,
      estimatedMinutes: morningRec.bestBand.estimatedDoorToDoor,
    },
    eveningRec: {
      bestBand: eveningRec.bestBand.label,
      fallbackBands: eveningRec.fallbackBands.map((b) => b.label),
      confidence: eveningRec.confidence,
      explanation: eveningRec.explanation,
      estimatedMinutes: eveningRec.bestBand.estimatedDoorToDoor,
    },
    activeRoutes,
    primaryRoute,
    additionalRoutes: additionalRoutes.filter(Boolean),
    usesLearnedPenalties: learnedPenalties !== null && correlations !== null && correlations.dataPoints >= 5,
    generatedAt: new Date().toISOString(),
  };
}

async function persistSnapshots(
  userId: string,
  transit: Awaited<ReturnType<typeof getTransitStatus>>,
  weather: Awaited<ReturnType<typeof getWeather>>,
  morningRec: ReturnType<typeof generateRecommendation>,
  eveningRec: ReturnType<typeof generateRecommendation>
) {
  await Promise.all([
    db.insert(transitSnapshots).values({
      route: "JSQ-WTC",
      status: transit.status,
      advisoryText: transit.advisoryText,
      headwayMin: transit.headwayMin,
      source: transit.source,
      sourceType: transit.source.includes("gtfs") ? "gtfsrt" : transit.source === "schedule" ? "schedule" : "panynj-json",
    }),
    db.insert(weatherSnapshots).values({
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      precipProbability: weather.precipProbability,
      precipType: weather.precipType,
      windSpeed: weather.windSpeed,
      condition: weather.condition,
      isSevere: weather.isSevere,
      forecastHours: weather.forecastHours,
      source: weather.source,
    }),
    db.insert(recommendationSnapshots).values({
      userId,
      direction: "outbound" as Direction,
      bestBand: morningRec.bestBand.label,
      fallbackBands: morningRec.fallbackBands.map((b) => b.label),
      confidence: morningRec.confidence,
      explanation: morningRec.explanation,
      scoringInputs: morningRec.scoringInputs,
    }),
    db.insert(recommendationSnapshots).values({
      userId,
      direction: "return" as Direction,
      bestBand: eveningRec.bestBand.label,
      fallbackBands: eveningRec.fallbackBands.map((b) => b.label),
      confidence: eveningRec.confidence,
      explanation: eveningRec.explanation,
      scoringInputs: eveningRec.scoringInputs,
    }),
  ]);
}
