/**
 * Recommendation Engine
 *
 * Deterministic rules-based engine for commute departure optimization.
 * Evaluates candidate departure bands and scores them.
 *
 * Scoring inputs:
 * 1. PATH advisory severity (0-1)
 * 2. Expected wait/headway
 * 3. Weather penalty (0-1)
 * 4. Historical median durations by band
 * 5. Walking duration assumptions
 * 6. Stale/missing data penalty
 *
 * Output:
 * - Best departure band
 * - 1-2 fallback bands
 * - Confidence level (high/medium/low)
 * - Plain-English explanation
 */

import { type TransitInfo, getTransitSeverity } from "@/lib/services/transit";
import { type WeatherInfo, getWeatherPenalty } from "@/lib/services/weather";

export type Confidence = "high" | "medium" | "low";
export type Direction = "outbound" | "return";

export interface DepartureBand {
  label: string; // e.g. "8:40–8:50 AM"
  startHour: number;
  startMinute: number;
  score: number; // lower is better
  estimatedDoorToDoor: number; // minutes
}

export interface Recommendation {
  direction: Direction;
  bestBand: DepartureBand;
  fallbackBands: DepartureBand[];
  confidence: Confidence;
  explanation: string;
  scoringInputs: {
    transitSeverity: number;
    weatherPenalty: number;
    dataQuality: number;
    historicalBasis: string;
  };
  generatedAt: Date;
}

export interface WalkingTimes {
  homeToJsq: number;
  wtcToOffice: number;
  officeToWtc: number;
  jsqToHome: number;
}

export interface HistoricalStats {
  medianByBand: Record<string, number>; // "08:40" -> 42 min
  sampleCount: number;
}

export interface LearnedPenalties {
  rain: number;
  snow: number;
  extremeTemp: number;
  highWind: number;
  transitDelay: number;
}

interface EngineInput {
  direction: Direction;
  transit: TransitInfo;
  weather: WeatherInfo;
  walking: WalkingTimes;
  historical: HistoricalStats | null;
  windowStart: string; // "08:30"
  windowEnd: string; // "10:00"
  baseTrainTimeMin?: number; // Override per-route (default 13)
  learnedPenalties?: LearnedPenalties | null; // v2.5: correlation-derived
}

const BAND_INTERVAL_MIN = 10; // Evaluate every 10 minutes
const BASE_TRAIN_TIME = 13; // JSQ to WTC ~13 min
const BASE_WAIT_TIME = 5; // Average wait time

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(":").map(Number);
  return { hour: h, minute: m };
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${minute.toString().padStart(2, "0")} ${period}`;
}

function formatBandLabel(hour: number, minute: number): string {
  const endMinute = minute + BAND_INTERVAL_MIN;
  const endHour = hour + Math.floor(endMinute / 60);
  const endMin = endMinute % 60;
  return `${formatTime(hour, minute)}–${formatTime(endHour, endMin)}`;
}

function bandKey(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function generateBands(
  windowStart: string,
  windowEnd: string
): { hour: number; minute: number }[] {
  const start = parseTime(windowStart);
  const end = parseTime(windowEnd);
  const bands: { hour: number; minute: number }[] = [];

  let h = start.hour;
  let m = start.minute;

  while (h < end.hour || (h === end.hour && m < end.minute)) {
    bands.push({ hour: h, minute: m });
    m += BAND_INTERVAL_MIN;
    if (m >= 60) {
      h += Math.floor(m / 60);
      m = m % 60;
    }
  }

  return bands;
}

function scoreBand(
  hour: number,
  minute: number,
  input: EngineInput
): DepartureBand {
  const { direction, transit, weather, walking, historical, baseTrainTimeMin, learnedPenalties } = input;
  const trainTime = baseTrainTimeMin ?? BASE_TRAIN_TIME;
  const lp = learnedPenalties;

  const transitSeverity = getTransitSeverity(transit);
  const weatherPenalty = getWeatherPenalty(weather);

  // Base door-to-door estimate
  let walkBefore: number, walkAfter: number;
  if (direction === "outbound") {
    walkBefore = walking.homeToJsq;
    walkAfter = walking.wtcToOffice;
  } else {
    walkBefore = walking.officeToWtc;
    walkAfter = walking.jsqToHome;
  }

  const waitTime = transit.headwayMin
    ? Math.min(transit.headwayMin / 2, 10)
    : BASE_WAIT_TIME;

  // Delay penalty: use learned if available, else heuristic
  const delayPenaltyMin = (lp && transitSeverity > 0 && lp.transitDelay > 0)
    ? transitSeverity * lp.transitDelay
    : transitSeverity * 15;

  // Weather impact: use learned penalties for specific conditions if available
  let weatherWalkPenalty = weatherPenalty * 3; // default heuristic
  if (lp) {
    const cond = weather.condition;
    if ((cond === "rain" || cond === "drizzle") && lp.rain > 0) {
      weatherWalkPenalty = lp.rain * weatherPenalty;
    } else if (cond === "snow" && lp.snow > 0) {
      weatherWalkPenalty = lp.snow * weatherPenalty;
    }
    // Add temperature/wind learned penalty (scaled by severity)
    if (lp.extremeTemp > 0 && (weather.feelsLike < 32 || weather.feelsLike > 85)) {
      weatherWalkPenalty += lp.extremeTemp * 0.5;
    }
    if (lp.highWind > 0 && weather.windSpeed > 18) {
      weatherWalkPenalty += lp.highWind * 0.3;
    }
  }

  // Historical adjustment
  const key = bandKey(hour, minute);
  let historicalAdj = 0;
  if (historical?.medianByBand[key] && historical.sampleCount >= 3) {
    const baseEstimate =
      walkBefore + waitTime + trainTime + walkAfter;
    historicalAdj = historical.medianByBand[key] - baseEstimate;
  }

  const estimatedDoorToDoor =
    walkBefore +
    waitTime +
    trainTime +
    walkAfter +
    delayPenaltyMin +
    weatherWalkPenalty +
    Math.max(historicalAdj, 0);

  // Score: lower is better (estimated total time + penalties)
  let score = estimatedDoorToDoor;

  // Slight preference for earlier departure in morning to account for uncertainty
  if (direction === "outbound") {
    const minutesFromStart = (hour - 8) * 60 + minute;
    score += minutesFromStart * 0.02; // Tiny penalty for later departures
  }

  // Stale data uncertainty
  if (transit.isStale) score += 3;
  if (weather.source === "unavailable") score += 2;

  return {
    label: formatBandLabel(hour, minute),
    startHour: hour,
    startMinute: minute,
    score: Math.round(score * 10) / 10,
    estimatedDoorToDoor: Math.round(estimatedDoorToDoor),
  };
}

function determineConfidence(
  transit: TransitInfo,
  weather: WeatherInfo,
  historical: HistoricalStats | null,
  bestScore: number,
  secondScore: number
): Confidence {
  // Low confidence scenarios
  if (transit.status === "suspended") return "low";
  if (transit.isStale && weather.source === "unavailable") return "low";
  if (transit.status === "delays" && weather.isSevere) return "low";

  // Medium confidence scenarios
  if (transit.isStale || weather.source === "unavailable") return "medium";
  if (transit.status === "delays") return "medium";
  if (!historical || historical.sampleCount < 5) return "medium";
  if (Math.abs(bestScore - secondScore) < 2) return "medium"; // Close scores

  return "high";
}

function generateExplanation(
  input: EngineInput,
  best: DepartureBand,
  confidence: Confidence
): string {
  const parts: string[] = [];

  // Transit status
  if (input.transit.status === "normal") {
    parts.push("PATH service is running normally");
  } else if (input.transit.status === "delays") {
    parts.push(
      `PATH is experiencing delays${input.transit.advisoryText ? ` (${input.transit.advisoryText})` : ""}`
    );
  } else if (input.transit.status === "suspended") {
    parts.push("PATH service is suspended — consider alternatives");
  }

  if (input.transit.isStale) {
    parts.push("transit data may be outdated");
  }

  // Historical context
  if (input.historical && input.historical.sampleCount >= 3) {
    parts.push(`based on ${input.historical.sampleCount} past trips`);
  }

  // Weather
  const wp = getWeatherPenalty(input.weather);
  if (wp > 0.3) {
    parts.push(
      `weather may slow your commute (${input.weather.condition}, ${Math.round(input.weather.precipProbability)}% precip chance)`
    );
  } else if (input.weather.precipProbability > 30) {
    parts.push(
      `${Math.round(input.weather.precipProbability)}% chance of ${input.weather.precipType || "precipitation"}`
    );
  }

  // Time estimate
  parts.push(`estimated ${best.estimatedDoorToDoor} min door-to-door`);

  // Confidence note
  if (confidence === "low") {
    parts.push("confidence is low — plan extra buffer time");
  }

  return parts.join(". ") + ".";
}

export function generateRecommendation(input: EngineInput): Recommendation {
  const bands = generateBands(input.windowStart, input.windowEnd);

  if (bands.length === 0) {
    return {
      direction: input.direction,
      bestBand: {
        label: "No bands available",
        startHour: 0,
        startMinute: 0,
        score: 999,
        estimatedDoorToDoor: 0,
      },
      fallbackBands: [],
      confidence: "low",
      explanation: "No departure bands in the configured window.",
      scoringInputs: {
        transitSeverity: 0,
        weatherPenalty: 0,
        dataQuality: 0,
        historicalBasis: "none",
      },
      generatedAt: new Date(),
    };
  }

  const scoredBands = bands
    .map((b) => scoreBand(b.hour, b.minute, input))
    .sort((a, b) => a.score - b.score);

  const best = scoredBands[0];
  const fallbacks = scoredBands.slice(1, 3);

  const confidence = determineConfidence(
    input.transit,
    input.weather,
    input.historical,
    best.score,
    fallbacks[0]?.score ?? best.score + 10
  );

  const explanation = generateExplanation(input, best, confidence);

  return {
    direction: input.direction,
    bestBand: best,
    fallbackBands: fallbacks,
    confidence,
    explanation,
    scoringInputs: {
      transitSeverity: getTransitSeverity(input.transit),
      weatherPenalty: getWeatherPenalty(input.weather),
      dataQuality:
        input.transit.isStale || input.weather.source === "unavailable"
          ? 0.5
          : 1.0,
      historicalBasis: input.historical
        ? `${input.historical.sampleCount} trips`
        : "none",
    },
    generatedAt: new Date(),
  };
}
