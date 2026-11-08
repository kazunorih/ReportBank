import { describe, expect, it } from "vitest";
import { barLabelScale, formatBarTotal, stackLabelValue, sumBarValues } from "./bar-totals";

describe("bar total labels", () => {
  it("labels only the last visible stack segment and excludes lines", () => {
    const row = { first: 12, second: 8, last: null, rate: 4 };
    expect(stackLabelValue(row, ["first", "second", "last"], "first")).toBeNull();
    expect(stackLabelValue(row, ["first", "second", "last"], "second")).toBe(20);
    expect(stackLabelValue(row, ["first", "second", "last"], "last")).toBeNull();
    expect(stackLabelValue({ first: null }, ["first"], "first")).toBeNull();
  });

  it("uses published totals where available and preserves zero", () => {
    expect(stackLabelValue({ part: 1.234, total: 1.23 }, ["part"], "part", "total")).toBe(1.23);
    expect(sumBarValues([null, undefined])).toBeNull();
    expect(sumBarValues([0, null])).toBe(0);
    expect(formatBarTotal(null)).toBe("");
    expect(formatBarTotal(0)).toBe("0.0");
    expect(formatBarTotal(1234.56)).toBe("1,234.6");
    expect(formatBarTotal(0.025)).toBe("0.025");
  });

  it("reserves label space for positive and negative datasets", () => {
    for (const values of [[0, 100], [-100, -20], [0], [null]]) {
      const scale = barLabelScale(values);
      expect(scale.domain[1]).toBeGreaterThan(Math.max(0, ...values.map(value => value ?? 0)));
      expect(scale.domain[0]).toBeLessThanOrEqual(Math.min(0, ...values.map(value => value ?? 0)));
    }
  });
});
