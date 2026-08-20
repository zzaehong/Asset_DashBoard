import { describe, expect, it } from "vitest";

import { toLocalDateInputValue } from "./date";

describe("toLocalDateInputValue", () => {
  it("uses local calendar fields instead of converting to UTC", () => {
    expect(toLocalDateInputValue(new Date(2026, 7, 20, 1, 30))).toBe("2026-08-20");
  });
});
