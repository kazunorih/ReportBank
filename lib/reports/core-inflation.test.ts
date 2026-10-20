import { describe, expect, it } from "vitest";
import { annualInflationRows, coreInflationData } from "./core-inflation";
import market from "./data/markets.json";

describe("annual core inflation", () => {
  it("retains the source coverage and missing values", () => {
    const rows = annualInflationRows(market, 50);
    expect(rows).toHaveLength(40);
    expect(rows[0].year).toBe(1986);
    expect(rows.at(-1)!.year).toBe(2025);
    expect(rows.map(row => row.year)).toEqual(Array.from({ length: 40 }, (_, i) => 1986 + i));
    for (const row of rows) {
      expect(Number.isFinite(row.weightedMedian)).toBe(true);
      expect(Number.isFinite(row.mode)).toBe(true);
      expect(row.trimmedMean === null).toBe(row.year < 2001);
      expect(row.core === null).toBe(row.year < 2016);
    }
    expect(coreInflationData.method).toBe("complete-calendar-year-mean-yoy-v1");
    expect(rows[0].weightedMedian).toBeCloseTo((1.3888614671117967 + 1.2207336585206321 + 1.1074544201234373 + 0.99673742310042401) / 4, 6);
  });

  it("uses December rates and preserves unavailable rates", () => {
    const report = { asOf: "2026-10-20", periods: ["2025-06-30", "2025-12-31"], series: [{ id: "jgb10", values: [9, 0], sourceIds: [] }] };
    const rows = annualInflationRows(report, 5);
    expect(rows).toHaveLength(5);
    expect(rows[0].jgb10).toBeNull();
    expect(rows.at(-1)!.jgb10).toBe(0);
    expect(annualInflationRows({ ...report, asOf: "2025-01-01" }, 5).at(-1)!.year).toBe(2024);
  });
});
