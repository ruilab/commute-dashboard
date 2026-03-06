/**
 * Ferry transit service — extensible adapter for ferry commute data.
 *
 * Current status: STUB. Ferry routes are defined but no live feed is integrated.
 * When a ferry user is onboarded, this module will be wired into the
 * dashboard/cron pipeline alongside the subway (PATH) service.
 *
 * Target: NYC Ferry (operated by Hornblower) — Hoboken ↔ Brookfield Place route.
 * API: https://www.ferry.nyc/ (schedule) — no official realtime API yet.
 *
 * Key differences from subway:
 * - Longer headway (20–30 min vs 4–10 min)
 * - High weather sensitivity (wind >25mph, fog, rough water → cancellations)
 * - Missed departure penalty is severe (30 min wait vs 4–10 min)
 * - Seasonal schedule changes
 */

import type { TransitInfo, TrainArrival } from "./transit";

export interface FerryRouteConfig {
  id: string;
  name: string;
  terminals: string[];
  baseCrossingTimeMin: number;
  peakHeadwayMin: number;
  offPeakHeadwayMin: number;
  // Weather thresholds for service impact
  windCancelThresholdMph: number;
  windDelayThresholdMph: number;
}

export const FERRY_ROUTES: Record<string, FerryRouteConfig> = {
  "HOB-BFP": {
    id: "HOB-BFP",
    name: "Hoboken ↔ Brookfield Place",
    terminals: ["Hoboken NJ Transit Terminal", "Brookfield Place"],
    baseCrossingTimeMin: 10,
    peakHeadwayMin: 20,
    offPeakHeadwayMin: 30,
    windCancelThresholdMph: 30,
    windDelayThresholdMph: 20,
  },
  "PAU-WFC": {
    id: "PAU-WFC",
    name: "Paulus Hook ↔ World Financial Center",
    terminals: ["Paulus Hook", "Brookfield Place"],
    baseCrossingTimeMin: 8,
    peakHeadwayMin: 15,
    offPeakHeadwayMin: 30,
    windCancelThresholdMph: 30,
    windDelayThresholdMph: 20,
  },
};

/**
 * Get ferry status for a route.
 * Currently returns schedule-based estimates.
 * Will be extended with live API data when available.
 */
export async function getFerryStatus(
  routeId = "HOB-BFP"
): Promise<TransitInfo> {
  const route = FERRY_ROUTES[routeId];
  if (!route) {
    return {
      status: "unknown",
      advisoryText: `Unknown ferry route: ${routeId}`,
      headwayMin: null,
      lastUpdated: new Date(),
      source: "ferry-schedule",
      isStale: true,
      nextArrivals: [],
      serviceAlerts: [],
      isWeekendSchedule: isWeekend(),
      isPlannedWork: false,
      realHeadwayMin: null,
    };
  }

  const headway = isPeak() ? route.peakHeadwayMin : route.offPeakHeadwayMin;

  return {
    status: "normal",
    advisoryText: null,
    headwayMin: headway,
    lastUpdated: new Date(),
    source: "ferry-schedule",
    isStale: false,
    nextArrivals: generateScheduledArrivals(headway),
    serviceAlerts: [],
    isWeekendSchedule: isWeekend(),
    isPlannedWork: false,
    realHeadwayMin: null,
  };
}

/**
 * Get ferry weather sensitivity score.
 * Ferries are much more weather-affected than subways.
 */
export function getFerryWeatherSeverity(
  windSpeed: number,
  routeId = "HOB-BFP"
): { status: "normal" | "delays" | "suspended"; penalty: number } {
  const route = FERRY_ROUTES[routeId];
  if (!route) return { status: "normal", penalty: 0 };

  if (windSpeed >= route.windCancelThresholdMph) {
    return { status: "suspended", penalty: 1.0 };
  }
  if (windSpeed >= route.windDelayThresholdMph) {
    return { status: "delays", penalty: 0.5 };
  }
  return { status: "normal", penalty: 0 };
}

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function isPeak(): boolean {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  if (day === 0 || day === 6) return false;
  return (hour >= 7 && hour < 10) || (hour >= 17 && hour < 20);
}

function generateScheduledArrivals(headwayMin: number): TrainArrival[] {
  const arrivals: TrainArrival[] = [];
  for (let i = 0; i < 3; i++) {
    arrivals.push({
      lineName: "Ferry",
      destination: "",
      arrivalMinutes: Math.round(headwayMin * (i + 0.5)),
      status: "on_time",
    });
  }
  return arrivals;
}
