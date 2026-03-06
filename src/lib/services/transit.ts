/**
 * Transit service for PATH train status.
 *
 * Multi-source data strategy (tried in order):
 * 1. PATH realtime arrival estimates (path.api via PANYNJ)
 * 2. PATH service alerts feed
 * 3. Schedule-based estimates (always available)
 *
 * All sources degrade gracefully. The service always returns
 * a result, with `source` and `isStale` indicating data quality.
 */

export type TransitStatus = "normal" | "delays" | "suspended" | "unknown";

export interface TrainArrival {
  lineName: string; // e.g. "JSQ-33 via HOB", "NWK-WTC"
  destination: string;
  arrivalMinutes: number; // minutes until arrival
  status: "on_time" | "delayed" | "approaching";
}

export interface ServiceAlert {
  title: string;
  description: string;
  affectsRoute: boolean; // affects JSQ-WTC
  severity: "info" | "warning" | "severe";
  startTime: Date | null;
  endTime: Date | null;
}

export interface TransitInfo {
  status: TransitStatus;
  advisoryText: string | null;
  headwayMin: number | null;
  lastUpdated: Date;
  source: string;
  isStale: boolean;
  // v2 additions
  nextArrivals: TrainArrival[];
  serviceAlerts: ServiceAlert[];
  isWeekendSchedule: boolean;
  isPlannedWork: boolean;
  realHeadwayMin: number | null; // Computed from actual arrival data
}

// ─── Route Configuration ───────────────────────────────────────────────────

export interface RouteConfig {
  id: string;
  name: string;
  stations: string[];
  keywords: string[]; // for matching in alerts/feeds
  baseTrainTimeMin: number;
}

export const ROUTES: Record<string, RouteConfig> = {
  "JSQ-WTC": {
    id: "JSQ-WTC",
    name: "Journal Square ↔ World Trade Center",
    stations: ["JSQ", "GRV", "EXP", "NWK", "HAR", "WTC"],
    keywords: [
      "JSQ", "Journal Square", "WTC", "World Trade",
      "Exchange Place", "Grove Street", "Newport",
    ],
    baseTrainTimeMin: 13,
  },
  "JSQ-33": {
    id: "JSQ-33",
    name: "Journal Square ↔ 33rd Street",
    stations: ["JSQ", "GRV", "NWP", "HOB", "CHR", "09S", "14S", "23S", "33S"],
    keywords: [
      "JSQ", "Journal Square", "33rd", "Hoboken",
      "Christopher", "9th", "14th", "23rd",
    ],
    baseTrainTimeMin: 25,
  },
  "HOB-WTC": {
    id: "HOB-WTC",
    name: "Hoboken ↔ World Trade Center",
    stations: ["HOB", "EXP", "WTC"],
    keywords: ["Hoboken", "HOB", "WTC", "World Trade", "Exchange Place"],
    baseTrainTimeMin: 15,
  },
  "HOB-33": {
    id: "HOB-33",
    name: "Hoboken ↔ 33rd Street",
    stations: ["HOB", "CHR", "09S", "14S", "23S", "33S"],
    keywords: ["Hoboken", "HOB", "33rd", "Christopher", "9th", "14th", "23rd"],
    baseTrainTimeMin: 18,
  },
};

// ─── Schedule Data ─────────────────────────────────────────────────────────

const SCHEDULE_HEADWAYS: Record<string, Record<string, number>> = {
  "JSQ-WTC": { peak: 4, offpeak: 10, weekend: 10 },
  "JSQ-33": { peak: 6, offpeak: 10, weekend: 10 },
  "HOB-WTC": { peak: 5, offpeak: 10, weekend: 10 },
  "HOB-33": { peak: 6, offpeak: 10, weekend: 10 },
};

function isWeekend(): boolean {
  const now = new Date();
  const day = now.getDay();
  return day === 0 || day === 6;
}

function isHoliday(): boolean {
  // Major US holidays where PATH runs weekend schedule
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();

  // Major US holidays where PATH runs weekend schedule
  const holidays = [
    month === 1 && date === 1,  // New Year's Day
    month === 7 && date === 4,  // July 4th
    month === 12 && date === 25, // Christmas
  ];
  return holidays.some(Boolean);
}

function getScheduleHeadway(routeId = "JSQ-WTC"): number {
  const now = new Date();
  const hour = now.getHours();
  const headways = SCHEDULE_HEADWAYS[routeId] || SCHEDULE_HEADWAYS["JSQ-WTC"];

  if (isWeekend() || isHoliday()) return headways.weekend;
  if ((hour >= 6 && hour < 10) || (hour >= 16 && hour < 20)) {
    return headways.peak;
  }
  return headways.offpeak;
}

// ─── PATH Realtime API ─────────────────────────────────────────────────────

/**
 * Fetch realtime arrival estimates from PATH.
 * Uses the PANYNJ realtime data feed.
 */
async function fetchPathRealtime(
  routeId = "JSQ-WTC"
): Promise<{
  arrivals: TrainArrival[];
  computedHeadway: number | null;
} | null> {
  try {
    // PATH realtime data from PANYNJ
    const res = await fetch(
      "https://www.panynj.gov/bin/portauthority/ridepath.json",
      {
        next: { revalidate: 60 }, // Cache 1 min for realtime
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results;
    if (!results || !Array.isArray(results)) return null;

    const route = ROUTES[routeId];
    if (!route) return null;

    const arrivals: TrainArrival[] = [];

    for (const entry of results) {
      // Try to parse arrival data from the feed
      const station = entry?.consideredStation || "";
      const isRelevant = route.keywords.some(
        (kw) =>
          station.toLowerCase().includes(kw.toLowerCase()) ||
          (entry?.headSign || "").toLowerCase().includes(kw.toLowerCase())
      );

      if (!isRelevant) continue;

      // Parse upcoming trains from the entry
      const upcomingTrains = entry?.messages || entry?.upcomingTrains || [];
      if (Array.isArray(upcomingTrains)) {
        for (const train of upcomingTrains) {
          const mins =
            train?.durationToArrival ??
            train?.secondsToArrival
              ? Math.round((train.secondsToArrival || 0) / 60)
              : null;

          if (mins !== null && mins >= 0) {
            arrivals.push({
              lineName: train?.lineName || train?.lineColor || routeId,
              destination: train?.headSign || train?.destination || "",
              arrivalMinutes: mins,
              status:
                mins <= 1
                  ? "approaching"
                  : train?.lastUpdated
                    ? "on_time"
                    : "delayed",
            });
          }
        }
      }
    }

    // Sort by arrival time
    arrivals.sort((a, b) => a.arrivalMinutes - b.arrivalMinutes);

    // Compute real headway from consecutive arrivals
    let computedHeadway: number | null = null;
    if (arrivals.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < arrivals.length; i++) {
        gaps.push(arrivals[i].arrivalMinutes - arrivals[i - 1].arrivalMinutes);
      }
      computedHeadway =
        Math.round(
          (gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10
        ) / 10;
    }

    return { arrivals: arrivals.slice(0, 5), computedHeadway };
  } catch {
    return null;
  }
}

// ─── Service Alerts ────────────────────────────────────────────────────────

async function fetchServiceAlerts(
  routeId = "JSQ-WTC"
): Promise<{
  alerts: ServiceAlert[];
  hasDelay: boolean;
  hasSuspension: boolean;
  isPlannedWork: boolean;
  advisoryText: string | null;
} | null> {
  try {
    const res = await fetch(
      "https://www.panynj.gov/bin/portauthority/ridepath.json",
      {
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results;
    if (!results || !Array.isArray(results)) return null;

    const route = ROUTES[routeId];
    if (!route) return null;

    const alerts: ServiceAlert[] = [];
    let hasDelay = false;
    let hasSuspension = false;
    let isPlannedWork = false;
    let advisoryText: string | null = null;

    for (const entry of results) {
      const stationOrRoute = entry?.consideredStation || entry?.route || "";
      const affectsRoute = route.keywords.some(
        (kw) =>
          stationOrRoute.toLowerCase().includes(kw.toLowerCase())
      );

      const statusMsg = entry?.statusMessage || entry?.status || "";
      const statusLower = statusMsg.toLowerCase();

      // Detect planned work
      if (
        statusLower.includes("planned") ||
        statusLower.includes("maintenance") ||
        statusLower.includes("scheduled")
      ) {
        isPlannedWork = true;
      }

      if (affectsRoute) {
        if (
          statusLower.includes("suspend") ||
          statusLower.includes("no service")
        ) {
          hasSuspension = true;
          advisoryText = statusMsg;
        } else if (
          statusLower.includes("delay") ||
          statusLower.includes("slow") ||
          (entry?.status &&
            entry.status !== "normal" &&
            entry.status !== "ON_TIME")
        ) {
          hasDelay = true;
          advisoryText = advisoryText || statusMsg;
        }

        if (statusMsg) {
          alerts.push({
            title: stationOrRoute,
            description: statusMsg,
            affectsRoute,
            severity: hasSuspension
              ? "severe"
              : hasDelay
                ? "warning"
                : "info",
            startTime: entry?.startTime ? new Date(entry.startTime) : null,
            endTime: entry?.endTime ? new Date(entry.endTime) : null,
          });
        }
      }
    }

    return {
      alerts,
      hasDelay,
      hasSuspension,
      isPlannedWork,
      advisoryText: advisoryText || null,
    };
  } catch {
    return null;
  }
}

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * Fetch comprehensive transit status from all available sources.
 * Merges realtime arrivals, service alerts, and schedule data.
 */
export async function getTransitStatus(
  routeId = "JSQ-WTC"
): Promise<TransitInfo> {
  const weekendSchedule = isWeekend() || isHoliday();
  const scheduleHeadway = getScheduleHeadway(routeId);

  // Fetch both sources in parallel
  const [realtimeData, alertData] = await Promise.all([
    fetchPathRealtime(routeId).catch(() => null),
    fetchServiceAlerts(routeId).catch(() => null),
  ]);

  // Determine status from alerts
  let status: TransitStatus = "normal";
  let advisoryText: string | null = null;
  let isPlannedWork = false;

  if (alertData) {
    if (alertData.hasSuspension) status = "suspended";
    else if (alertData.hasDelay) status = "delays";
    advisoryText = alertData.advisoryText;
    isPlannedWork = alertData.isPlannedWork;
  }

  // Determine headway: prefer computed real headway over schedule
  const realHeadway = realtimeData?.computedHeadway ?? null;
  const headwayMin = realHeadway ?? scheduleHeadway;

  // Determine source quality
  const hasRealtime = realtimeData !== null && realtimeData.arrivals.length > 0;
  const hasAlerts = alertData !== null;
  const source = hasRealtime
    ? "path-realtime"
    : hasAlerts
      ? "path-alerts"
      : "schedule";

  return {
    status,
    advisoryText,
    headwayMin,
    lastUpdated: new Date(),
    source,
    isStale: !hasRealtime && !hasAlerts,
    nextArrivals: realtimeData?.arrivals ?? [],
    serviceAlerts: alertData?.alerts ?? [],
    isWeekendSchedule: weekendSchedule,
    isPlannedWork,
    realHeadwayMin: realHeadway,
  };
}

/**
 * Get the severity score for transit status (0-1, higher = worse)
 */
export function getTransitSeverity(info: TransitInfo): number {
  let severity = 0;

  // Base severity from status
  switch (info.status) {
    case "normal":
      severity = 0;
      break;
    case "delays":
      severity = 0.5;
      break;
    case "suspended":
      severity = 1.0;
      break;
    case "unknown":
      severity = 0.3;
      break;
  }

  // Adjust for data quality
  if (info.isStale) severity = Math.max(severity, 0.3);

  // If real headway is significantly worse than schedule, bump severity
  if (info.realHeadwayMin !== null) {
    const schedHeadway = getScheduleHeadway();
    if (info.realHeadwayMin > schedHeadway * 2) {
      severity = Math.max(severity, 0.4);
    }
    if (info.realHeadwayMin > schedHeadway * 3) {
      severity = Math.max(severity, 0.6);
    }
  }

  // Planned work indicator
  if (info.isPlannedWork && info.status === "normal") {
    severity = Math.max(severity, 0.15);
  }

  return Math.min(severity, 1.0);
}

/**
 * Get route config by ID, defaulting to JSQ-WTC.
 */
export function getRouteConfig(routeId = "JSQ-WTC"): RouteConfig {
  return ROUTES[routeId] || ROUTES["JSQ-WTC"];
}
