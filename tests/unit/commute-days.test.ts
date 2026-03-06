import { describe, it, expect } from "bun:test";
import { commuteDaysLabel } from "../../src/lib/commute-days";

describe("commuteDaysLabel", () => {
  it("returns Mon–Fri for weekdays", () => {
    expect(commuteDaysLabel("weekdays")).toBe("Mon–Fri");
  });

  it("returns Every day for all", () => {
    expect(commuteDaysLabel("all")).toBe("Every day");
  });

  it("returns custom day names", () => {
    const result = commuteDaysLabel("custom", [1, 3, 5]);
    expect(result).toBe("Mon, Wed, Fri");
  });

  it("defaults to weekdays for unknown", () => {
    expect(commuteDaysLabel("unknown")).toBe("Mon–Fri");
  });
});
