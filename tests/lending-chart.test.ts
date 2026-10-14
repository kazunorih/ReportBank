import { describe, expect, it } from "vitest";
import marketSnapshot from "@/lib/reports/data/markets.json";
import { marketChartSchema } from "@/lib/reports/schema";
import { withLendingChart } from "@/lib/reports/lending";
import lendingSnapshot from "@/lib/reports/data/lending.json";

describe("BOJ lending chart", () => {
  it("aligns both balances with 60 half-year ends, converts units and reuses the exact market rates", () => {
    const market = marketChartSchema.parse(marketSnapshot);
    const result = withLendingChart(market);
    expect(result.periods).toBe(market.periods);
    for (const id of ["jgb10", "jgb30", "flat35"]) {
      expect(result.series.find((s) => s.id === id)).toBe(market.series.find((s) => s.id === id));
    }
    const other = result.series.find((s) => s.id === "otherLoans")!;
    const housing = result.series.find((s) => s.id === "housingLoans")!;
    const corporate = result.series.find((s) => s.id === "domesticCorporateLoans")!;
    expect(other.values).toHaveLength(60);
    expect(other.values.every((v) => v !== null)).toBe(true);
    expect(housing.values.every((v) => v !== null)).toBe(true);
    expect(other.values[0]).toBe(47.8166);
    expect(corporate.values[0]).toBe(409.0398);
    expect(housing.values[0]).toBe(55.2039);
    expect(other.values.at(-1)).toBe(62.3718);
    expect(corporate.values.at(-1)).toBe(452.9334);
    expect(housing.values.at(-1)).toBe(159.7284);
    result.periods.forEach((period, index) => {
      const original = lendingSnapshot.observations.find((row) => row.date === period)!;
      expect(other.values[index]! + housing.values[index]! + corporate.values[index]!).toBeCloseTo(original.domesticBankLoans, 8);
      expect(other.values[index]).toBeGreaterThanOrEqual(0);
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
