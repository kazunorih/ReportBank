import { describe, expect, it } from "vitest";
import gdp from "./data/gdp.json";
import totals from "./data/gdp-totals.json";
import exchange from "./data/gdp-usd-exchange.json";
import { trillionUsd, usdGdpData, usdGdpSeries } from "./gdp-usd";

describe("USD nominal GDP at annual average exchange rates", () => {
  it("divides JPY by JPY per USD and converts billions to trillions", () => {
    expect(trillionUsd(600_000, 150)).toBe(4);
    expect(() => trillionUsd(600_000, 0)).toThrow();
    expect(() => trillionUsd(600_000, NaN)).toThrow();
  });

  it("covers the same years and preserves FIGURE01 industry shares and totals", () => {
    expect(usdGdpData.map(point => point.year)).toEqual(Array.from({ length: totals.latestYear - gdp.firstYear + 1 }, (_, i) => gdp.firstYear + i));
    for (const original of gdp.points) {
      const point = usdGdpData.find(point => point.year === original.year)!;
      const rate = exchange.points.find(rate => rate.year === original.year)!.yenPerUsd;
      expect(point.total).toBeCloseTo(original.total / rate / 1_000, 12);
      expect(usdGdpSeries.reduce((sum, series) => sum + Number(point[series.key]), 0)).toBeCloseTo(Number(point.total), 5);
      for (const item of usdGdpSeries) expect(Number(point[item.key]) / Number(point.total)).toBeCloseTo((original as Record<string, number>)[item.key] / original.total, 12);
    }
  });

  it("keeps years with only GDP totals separate instead of fabricating industry data", () => {
    for (const point of usdGdpData.filter(point => Number(point.year) > gdp.latestYear)) {
      expect(point.nominalOnly).toBe(point.total);
      expect(usdGdpSeries.every(item => point[item.key] === null)).toBe(true);
    }
    expect(exchange.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(exchange.points.every(rate => rate.yenPerUsd > 0)).toBe(true);
  });
});
