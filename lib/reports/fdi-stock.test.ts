import { describe, expect, it } from "vitest";
import { fdiStockData } from "./fdi-stock";
import { examplesForCommodity } from "./trade-examples";
import { tradeData } from "./trade";

describe("JETRO outward FDI stock", () => {
  it("uses the latest top eight destinations, excluding regional totals", () => {
    expect(fdiStockData.categories).toEqual(["米国", "オランダ", "英国", "シンガポール", "中国", "オーストラリア", "タイ", "スイス", "その他"]);
    const latest = fdiStockData.points.at(-1)!;
    expect(latest.year).toBe(2025);
    expect(latest.values.slice(0, 8)).toEqual([...latest.values.slice(0, 8)].sort((a, b) => b - a));
    // Independently checked against the 2025 JETRO workbook, million USD.
    expect(latest.values[0]).toBeCloseTo(829345.0214882741, 5);
    expect(latest.values[7]).toBeCloseTo(80149.104576714963, 5);
    expect(latest.total).toBeCloseTo(2465284.0114804399, 5);
  });

  it("preserves consecutive year-end data and reconciles every stack", () => {
    expect(fdiStockData.unit).toBe("100万米ドル");
    expect(fdiStockData.points.map(point => point.year)).toEqual(Array.from({ length: 30 }, (_, i) => 1996 + i));
    expect(fdiStockData.firstYear).toBe(1996);
    expect(fdiStockData.latestYear).toBe(2025);
    for (const point of fdiStockData.points) {
      expect(point.values).toHaveLength(9);
      expect(point.values.every(value => Number.isFinite(value) && value >= 0)).toBe(true);
      expect(point.values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(point.total, 5);
    }
  });
});

describe("commodity examples", () => {
  it("provides two or three examples for every displayed commodity group", () => {
    for (const chart of tradeData.charts.filter(chart => chart.id.startsWith("commodity"))) {
      for (const name of chart.categories) {
        expect(examplesForCommodity(name, chart.categories).length).toBeGreaterThanOrEqual(2);
        expect(examplesForCommodity(name, chart.categories).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("derives residual examples from unselected groups", () => {
    const exports = tradeData.charts.find(chart => chart.id === "commodity-export")!;
    const imports = tradeData.charts.find(chart => chart.id === "commodity-import")!;
    expect(examplesForCommodity("その他", exports.categories)).not.toContain("自動車");
    expect(examplesForCommodity("その他", imports.categories)).toContain("自動車");
  });
});
