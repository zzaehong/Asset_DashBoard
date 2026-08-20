import { describe, expect, it } from "vitest";

import { occurrenceDateForMonth, shiftMonth } from "./recurrence";

describe("monthly recurrence helpers", () => {
  it("moves between calendar months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("returns only the original month for a one-time event", () => {
    expect(occurrenceDateForMonth("2026-08-15", null, null, "2026-08")).toBe("2026-08-15");
    expect(occurrenceDateForMonth("2026-08-15", null, null, "2026-09")).toBeNull();
  });

  it("expands a recurring event and respects its end date", () => {
    expect(occurrenceDateForMonth("2026-08-31", 1, "2026-10-31", "2026-09")).toBe("2026-09-30");
    expect(occurrenceDateForMonth("2026-08-31", 1, "2026-10-31", "2026-11")).toBeNull();
  });
});
