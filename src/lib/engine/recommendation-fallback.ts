import type {
  DepartureBand,
  Direction,
  Recommendation,
  WalkingTimes,
} from "@/lib/engine/recommend";

interface RecommendationFallbackInput {
  direction: Direction;
  walking: WalkingTimes;
  windowStart: string;
  windowEnd: string;
  baseTrainTimeMin: number;
}

const BAND_INTERVAL_MIN = 10;
const BASE_WAIT_MIN = 5;
const MAX_FALLBACK_BANDS = 3;

function parseTimeToMinutes(value: string): number {
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  const hour = Number.isFinite(hourRaw) ? Math.min(Math.max(hourRaw, 0), 23) : 8;
  const minute = Number.isFinite(minuteRaw)
    ? Math.min(Math.max(minuteRaw, 0), 59)
    : 30;
  return hour * 60 + minute;
}

function formatMinutes(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

function buildBandLabel(startMinutes: number): string {
  return `${formatMinutes(startMinutes)}-${formatMinutes(
    startMinutes + BAND_INTERVAL_MIN
  )}`;
}

function buildBand(
  startMinutes: number,
  estimatedDoorToDoor: number,
  scoreBase: number
): DepartureBand {
  return {
    label: buildBandLabel(startMinutes),
    startHour: Math.floor(startMinutes / 60) % 24,
    startMinute: startMinutes % 60,
    score: scoreBase,
    estimatedDoorToDoor: Math.max(1, Math.round(estimatedDoorToDoor)),
  };
}

function getBaseDoorToDoorEstimate(
  direction: Direction,
  walking: WalkingTimes,
  baseTrainTimeMin: number
): number {
  const walkBefore =
    direction === "outbound" ? walking.homeToJsq : walking.officeToWtc;
  const walkAfter =
    direction === "outbound" ? walking.wtcToOffice : walking.jsqToHome;

  return walkBefore + BASE_WAIT_MIN + baseTrainTimeMin + walkAfter;
}

export function buildRecommendationFallback(
  input: RecommendationFallbackInput
): Recommendation {
  const startMin = parseTimeToMinutes(input.windowStart);
  const endMin = parseTimeToMinutes(input.windowEnd);
  const effectiveEndMin =
    endMin > startMin ? endMin : startMin + BAND_INTERVAL_MIN * MAX_FALLBACK_BANDS;

  const bandStarts = Array.from({ length: MAX_FALLBACK_BANDS }, (_, index) =>
    startMin + index * BAND_INTERVAL_MIN
  ).filter((bandStart, index) => index === 0 || bandStart < effectiveEndMin);

  const baseEstimate = getBaseDoorToDoorEstimate(
    input.direction,
    input.walking,
    input.baseTrainTimeMin
  );

  const bands = bandStarts.map((bandStart, index) =>
    buildBand(bandStart, baseEstimate + index * 2, 900 + index * 5)
  );

  return {
    direction: input.direction,
    bestBand: bands[0],
    fallbackBands: bands.slice(1),
    confidence: "low",
    explanation:
      "Live recommendation scoring is temporarily unavailable. This schedule-based fallback keeps your configured departure window. Leave 10 extra minutes of buffer.",
    scoringInputs: {
      transitSeverity: 0.3,
      weatherPenalty: 0.1,
      dataQuality: 0.2,
      historicalBasis: "fallback",
    },
    generatedAt: new Date(),
  };
}
