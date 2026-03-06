import { describe, expect, it } from "bun:test";
import { buildRecommendationFallback } from "../../src/lib/engine/recommendation-fallback";

const walking = {
  homeToJsq: 8,
  wtcToOffice: 10,
  officeToWtc: 11,
  jsqToHome: 9,
};

describe("recommendation fallback", () => {
  it("returns low-confidence recommendation with fallback bands", () => {
    const fallback = buildRecommendationFallback({
      direction: "outbound",
      walking,
      windowStart: "08:30",
      windowEnd: "09:30",
      baseTrainTimeMin: 13,
    });

    expect(fallback.confidence).toBe("low");
    expect(fallback.bestBand.label).toContain("AM");
    expect(fallback.fallbackBands.length).toBeGreaterThan(0);
    expect(fallback.explanation).toContain("schedule-based fallback");
  });

  it("keeps best band available when window is invalid", () => {
    const fallback = buildRecommendationFallback({
      direction: "return",
      walking,
      windowStart: "20:00",
      windowEnd: "19:00",
      baseTrainTimeMin: 13,
    });

    expect(fallback.bestBand.label).toBeTruthy();
    expect(fallback.fallbackBands.length).toBeGreaterThanOrEqual(0);
    expect(fallback.bestBand.estimatedDoorToDoor).toBeGreaterThan(0);
  });
});
