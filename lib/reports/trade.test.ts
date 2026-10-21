import { describe, expect, it } from "vitest";
import { tradeData } from "./trade";

describe("published trade snapshot", () => {
  it("contains four charts covering consecutive months starting in January 2000", () => {
    expect(tradeData.charts.map(chart => chart.id)).toEqual(["country-export", "country-import", "commodity-export", "commodity-import"]);
    const months = tradeData.sources.map(source => source.month);
    expect(months[0]).toBe("2000-01");
    expect(tradeData.firstMonth).toBe("2000-01");
    expect(months.at(-1)).toBe(tradeData.latestMonth);
    expect(months).toHaveLength((Number(tradeData.latestMonth.slice(0, 4)) - 2000) * 12 + Number(tradeData.latestMonth.slice(5)));
    const ordinal = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5));
    months.slice(1).forEach((month, i) => expect(ordinal(month) - ordinal(months[i])).toBe(1));
    for (const chart of tradeData.charts) {
      expect(chart.points.map(point => point.month)).toEqual(months);
      const count = chart.id.startsWith("country") ? 8 : 5;
      expect(chart.categories).toHaveLength(count + 1);
      expect(new Set(chart.categories).size).toBe(count + 1);
      expect(chart.categories[count]).toBe("その他");
      for (const point of chart.points) {
        expect(point.values).toHaveLength(count + 1);
        if (point.values.every(value => value === null)) {
          expect(chart.id.startsWith("commodity")).toBe(true);
          expect(point.month < "2004-01").toBe(true);
          continue;
        }
        expect(point.values.every(value => value !== null && Number.isInteger(value) && value >= 0)).toBe(true);
        expect(point.values.reduce((sum, value) => sum! + value!, 0)).toBe(point.total);
      }
      const top = chart.points.at(-1)!.values.slice(0, count).map(value => {
        expect(value).not.toBeNull();
        return value!;
      });
      expect(top).toEqual([...top].sort((a, b) => b - a));
    }
  });

  it("reconciles the country and commodity totals in each month", () => {
    for (let month = 0; month < tradeData.sources.length; month++) {
      expect(tradeData.charts[0].points[month].total).toBe(tradeData.charts[2].points[month].total);
      expect(tradeData.charts[1].points[month].total).toBe(tradeData.charts[3].points[month].total);
    }
    expect(tradeData.sources.every(source => source.sourceUrl.startsWith("https://www.customs.go.jp/toukei/shinbun/trade-st/"))).toBe(true);
  });
});
