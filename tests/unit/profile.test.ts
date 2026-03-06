import { describe, expect, test } from "bun:test";
import { normalizePreferredModes } from "@/lib/profile";

describe("normalizePreferredModes", () => {
  test("keeps order and removes duplicates for valid modes", () => {
    expect(normalizePreferredModes(["path", "subway", "path", "bus"], "subway")).toEqual([
      "path",
      "subway",
      "bus",
    ]);
  });

  test("filters unknown values and falls back to path for subway mode", () => {
    expect(normalizePreferredModes(["hovercraft"], "subway")).toEqual(["path"]);
  });

  test("falls back to ferry when primary mode is ferry", () => {
    expect(normalizePreferredModes([], "ferry")).toEqual(["ferry"]);
  });
});
