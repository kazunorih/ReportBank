import { describe, expect, it } from "vitest";
import { portTradeData } from "./port-trade";
import { tradeData } from "./trade";

describe("ordinary trade by port/customs office", () => {
  it("covers every month from January 2000 with eight fixed ports and other", () => {
    expect(portTradeData.unit).toBe("千円");
    expect(portTradeData.basis).toBe("customs-clearance-three-digit-code");
    expect(portTradeData.firstMonth).toBe("2000-01");
    expect(portTradeData.latestMonth).toBe(tradeData.latestMonth);
    expect(portTradeData.charts.map(chart => chart.id)).toEqual(["port-export", "port-import"]);
    for (const chart of portTradeData.charts) {
      expect(chart.categories).toHaveLength(9);
      expect(new Set(chart.categories).size).toBe(9);
      expect(chart.categories[8]).toBe("その他");
      expect(chart.portCodes).toHaveLength(8);
      expect(chart.points.map(point => point.month)).toEqual(tradeData.sources.map(source => source.month));
      for (const point of chart.points) {
        expect(point.values).toHaveLength(9);
        expect(point.values.every(value => Number.isSafeInteger(value) && value >= 0)).toBe(true);
        expect(point.values.reduce((sum, value) => sum + value, 0)).toBe(point.total);
      }
      const top = chart.points.at(-1)!.values.slice(0, 8);
      expect(top).toEqual([...top].sort((a, b) => b - a));
    }
  });

  it("agrees with independently read official national totals", () => {
    const exports = portTradeData.charts[0];
    // 2000-12 e-Stat national-country PDF, both columns and country 701 included.
    expect(exports.points.find(row => row.month === "2000-12")!.total).toBe(4_631_555_840);
    // 2026-08 national-country CSV; source values are thousands, not millions.
    expect(exports.points.at(-1)!.total).toBe(10_043_269_534);
    expect(portTradeData.charts[1].points.at(-1)!.total).toBeGreaterThan(10_000_000_000);
    for (let i = 0; i < 2; i++) {
      expect(Math.abs(portTradeData.charts[i].points.at(-1)!.total / 1000 - tradeData.charts[i].points.at(-1)!.total)).toBeLessThan(1);
    }
  });

  it("retains e-Stat provenance for both directions and every release year", () => {
    expect(portTradeData.sources).toHaveLength((Number(portTradeData.latestMonth.slice(0, 4)) - 1999) * 2);
    for (const source of portTradeData.sources) {
      expect(source.page).toMatch(/^https:\/\/www\.e-stat\.go\.jp\/stat-search\/files\?/);
      expect(source.page).toContain("tstat=000001013143");
      expect(source.fileCount).toBeGreaterThan(0);
    }
  });
});
