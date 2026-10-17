import { describe, expect, it } from "vitest";
import marketSnapshot from "@/lib/reports/data/markets.json";
import { marketChartSchema } from "@/lib/reports/schema";
import { withLendingChart } from "@/lib/reports/lending";

describe("BOJ lending chart", () => {
  it("aligns 100 half-year ends, preserves unknown corporate splits and reuses the exact market rates", () => {
    const market = marketChartSchema.parse(marketSnapshot);
    const result = withLendingChart(market);
    expect(result.periods).toBe(market.periods);
    for (const id of ["jgb10", "jgb30", "flat35"]) {
      expect(result.series.find((s) => s.id === id)).toBe(market.series.find((s) => s.id === id));
    }
    const other = result.series.find((s) => s.id === "otherLoans")!;
    const housing = result.series.find((s) => s.id === "housingLoans")!;
    const corporate = result.series.find((s) => s.id === "domesticCorporateLoans")!;
    const unclassified = result.series.find((s) => s.id === "unclassifiedLoans")!;
    expect(other.values).toHaveLength(100);
    expect(result.periods[0]).toBe("1976-12-31");
    expect(other.values[0]).toBeNull();
    expect(corporate.values[0]).toBeNull();
    expect(unclassified.values[0]).toBeGreaterThan(0);
    expect(housing.values.every((v) => v !== null)).toBe(true);
    const oldStart = result.periods.indexOf("1996-12-31");
    expect(other.values[oldStart]).toBe(47.8166);
    expect(corporate.values[oldStart]).toBe(409.0398);
    expect(housing.values[oldStart]).toBe(55.2039);
    expect(other.values.at(-1)).toBe(62.3718);
    expect(corporate.values.at(-1)).toBe(452.9334);
    expect(housing.values.at(-1)).toBe(159.7284);
    result.periods.forEach((period, index) => {
      const original = market.lending!.observations.find((row) => row.date === period)!;
      expect((other.values[index] ?? 0) + housing.values[index]! + (corporate.values[index] ?? 0) + (unclassified.values[index] ?? 0)).toBeCloseTo(original.domesticBankLoans!, 8);
      if (period < "1993-06-30") {
        expect(corporate.values[index]).toBeNull();
        expect(other.values[index]).toBeNull();
      } else {
        expect(unclassified.values[index]).toBeNull();
        expect(other.values[index]).toBeGreaterThanOrEqual(0);
      }
    });
    expect(other.latestDate).toBe("2026-06-30");
    expect(result.sources.find((s) => s.id === other.sourceIds[0])?.url).toBe("https://www.stat-search.boj.or.jp/ssi/cgi-bin/famecgi2?cgi=$nme_a000&lstSelection=LA01");
    expect(result.insight).toBe(market.insight);
  });

  it("does not fill future half-years with the last known balance", () => {
    const market = marketChartSchema.parse(marketSnapshot);
    const future = withLendingChart({ ...market, asOf: "2026-12-31", periods: [...market.periods.slice(1), "2026-12-31"] });
    expect(future.series.find((s) => s.id === "otherLoans")?.values.at(-1)).toBeNull();
  });

  it("rejects overlapping loan components", () => {
    const bad = structuredClone(marketSnapshot);
    bad.lending.observations[0].domesticCorporateLoans = bad.lending.observations[0].domesticBankLoans;
    expect(marketChartSchema.safeParse(bad).success).toBe(false);
  });
});
