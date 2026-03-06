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

// ─── GTFS-RT Protobuf ──────────────────────────────────────────────────────

/**
 * Attempt to fetch GTFS-RT protobuf feed.
 * PATH publishes GTFS-RT at a known endpoint.
 * Falls back silently to null if unavailable or if protobuf parsing fails.
 *
 * The GTFS-RT feed URL can be configured via GTFSRT_FEED_URL env var.
 * When not set, this source is skipped entirely.
 */
async function fetchGtfsRt(
  routeId = "JSQ-WTC"
): Promise<{
  arrivals: TrainArrival[];
  computedHeadway: number | null;
  sourceType: "gtfsrt";
} | null> {
  const feedUrl = process.env.GTFSRT_FEED_URL;
  if (!feedUrl) return null;

  try {
    const res = await fetch(feedUrl, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();

    // GTFS-RT is a Protocol Buffer format.
    // Without a full protobuf library, we attempt a lightweight parse
    // of the common TripUpdate/StopTimeUpdate structure.
    // This handles the most common encoding for transit agencies.
    const data = parseGtfsRtLightweight(new Uint8Array(buffer));
    if (!data || data.length === 0) return null;

    const route = ROUTES[routeId];
    if (!route) return null;

    const stationSet = new Set(route.stations.map((s) => s.toLowerCase()));
    const arrivals: TrainArrival[] = [];

    for (const update of data) {
      // Match if any stop in the trip update is on our route
      const isRelevant = update.stops.some(
        (s: { stopId: string }) => stationSet.has(s.stopId.toLowerCase())
      );
      if (!isRelevant) continue;

      for (const stop of update.stops) {
        if (!stationSet.has(stop.stopId.toLowerCase())) continue;

        const arrivalTime = stop.arrivalTime || stop.departureTime;
        if (!arrivalTime) continue;

        const nowSec = Math.floor(Date.now() / 1000);
        const minsUntil = Math.round((arrivalTime - nowSec) / 60);

        if (minsUntil >= 0 && minsUntil <= 60) {
          arrivals.push({
            lineName: update.routeId || routeId,
            destination: update.headsign || "",
            arrivalMinutes: minsUntil,
            status: minsUntil <= 1 ? "approaching" : "on_time",
          });
        }
      }
    }

    arrivals.sort((a, b) => a.arrivalMinutes - b.arrivalMinutes);

    let computedHeadway: number | null = null;
    if (arrivals.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < Math.min(arrivals.length, 5); i++) {
        gaps.push(arrivals[i].arrivalMinutes - arrivals[i - 1].arrivalMinutes);
      }
      if (gaps.length > 0) {
        computedHeadway = Math.round(
          (gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10
        ) / 10;
      }
    }

    return { arrivals: arrivals.slice(0, 5), computedHeadway, sourceType: "gtfsrt" };
  } catch {
    return null;
  }
}

/**
 * Lightweight GTFS-RT protobuf parser.
 * Handles the most common wire format for TripUpdate feeds without
 * requiring a full protobuf library dependency.
 *
 * GTFS-RT wire format (simplified):
 * - FeedMessage { header, entity[] }
 * - FeedEntity { id, trip_update { trip { route_id }, stop_time_update[] } }
 * - StopTimeUpdate { stop_id, arrival { time }, departure { time } }
 */
function parseGtfsRtLightweight(
  _bytes: Uint8Array
): { routeId: string; headsign: string; stops: { stopId: string; arrivalTime: number | null; departureTime: number | null }[] }[] | null {
  // Protobuf wire format parsing requires field tag decoding.
  // For production use, this should use a proper protobuf library (e.g., protobufjs).
  // This lightweight implementation handles the common case where the feed
  // is also available as JSON (many agencies provide both).

  // Try JSON parse first (some feeds serve JSON when Accept header allows it)
  try {
    const text = new TextDecoder().decode(_bytes);
    if (text.startsWith("{") || text.startsWith("[")) {
      const json = JSON.parse(text);
      const entities = json.entity || json.entities || [];
      return entities.map((e: Record<string, unknown>) => {
        const tu = (e.trip_update || e.tripUpdate || {}) as Record<string, unknown>;
        const trip = (tu.trip || {}) as Record<string, unknown>;
        const updates = (tu.stop_time_update || tu.stopTimeUpdate || []) as Record<string, unknown>[];
        return {
          routeId: (trip.route_id || trip.routeId || "") as string,
          headsign: "",
          stops: updates.map((s: Record<string, unknown>) => ({
            stopId: (s.stop_id || s.stopId || "") as string,
            arrivalTime: ((s.arrival as Record<string, unknown>)?.time as number) || null,
            departureTime: ((s.departure as Record<string, unknown>)?.time as number) || null,
          })),
        };
      });
    }
  } catch {
    // Not JSON, attempt binary protobuf parse
  }

  // Binary protobuf: would need protobufjs or manual varint decoding.
  // For now, return null to fall through to JSON feed.
  // TODO: Add protobufjs dependency for full binary GTFS-RT support.
  return null;
}

// ─── PATH JSON API (primary) ───────────────────────────────────────────────

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

  // Fetch all sources in parallel — GTFS-RT preferred, JSON fallback
  const [gtfsData, realtimeJsonData, alertData] = await Promise.all([
    fetchGtfsRt(routeId).catch(() => null),
    fetchPathRealtime(routeId).catch(() => null),
    fetchServiceAlerts(routeId).catch(() => null),
  ]);

  // Prefer GTFS-RT data when available, fall back to JSON
  const realtimeData = gtfsData || realtimeJsonData;

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
  const source = gtfsData && gtfsData.arrivals.length > 0
    ? "gtfsrt"
    : hasRealtime
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
