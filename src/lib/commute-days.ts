/**
 * Commute day logic — determines if today is a commute day for a user.
 */

import type { CommuteDays } from "@/lib/db/schema";

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

export function isCommuteDay(
  commuteDays: CommuteDays | string,
  customDays?: number[] | null
): boolean {
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  switch (commuteDays) {
    case "weekdays":
      return WEEKDAYS.includes(today);
    case "all":
      return true;
    case "custom":
      return (customDays ?? WEEKDAYS).includes(today);
    default:
      return WEEKDAYS.includes(today); // safe default
  }
}

export function commuteDaysLabel(
  commuteDays: CommuteDays | string,
  customDays?: number[] | null
): string {
  switch (commuteDays) {
    case "weekdays":
      return "Mon–Fri";
    case "all":
      return "Every day";
    case "custom": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return (customDays ?? WEEKDAYS).map((d) => names[d]).join(", ");
    }
    default:
      return "Mon–Fri";
  }
}
