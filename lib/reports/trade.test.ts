import { describe, expect, it } from "vitest";
import { tradeData } from "./trade";

describe("published trade snapshot", () => {
  it("contains four charts covering the same 60 consecutive months", () => {
    expect(tradeData.charts.map(chart => chart.id)).toEqual(["country-export", "country-import", "commodity-export", "commodity-import"]);
    const months = tradeData.sources.map(source => source.month);
    expect(months).toHaveLength(60);
    const ordinal = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5));
    months.slice(1).forEach((month, i) => expect(ordinal(month) - ordinal(months[i])).toBe(1));
    for (const chart of tradeData.charts) {
      expect(chart.points.map(point => point.month)).toEqual(months);
      expect(chart.categories).toHaveLength(6);
      expect(new Set(chart.categories).size).toBe(6);
      expect(chart.categories[5]).toBe("その他");
      for (const point of chart.points) {
        expect(point.values).toHaveLength(6);
        expect(point.values.every(value => Number.isInteger(value) && value >= 0)).toBe(true);
        expect(point.values.reduce((sum, value) => sum + value, 0)).toBe(point.total);
      }
      const top = chart.points.at(-1)!.values.slice(0, 5);
      expect(top).toEqual([...top].sort((a, b) => b - a));
    }
  });

  it("reconciles the country and commodity totals in each month", () => {
    for (let month = 0; month < 60; month++) {
      expect(tradeData.charts[0].points[month].total).toBe(tradeData.charts[2].points[month].total);
      expect(tradeData.charts[1].points[month].total).toBe(tradeData.charts[3].points[month].total);
    }
    expect(tradeData.sources.every(source => source.sourceUrl.startsWith("https://www.customs.go.jp/toukei/shinbun/trade-st/"))).toBe(true);
  });
});
