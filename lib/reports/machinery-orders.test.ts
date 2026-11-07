import { describe, expect, it } from "vitest";
import orders from "./data/machinery-orders.json";
import { annualMachineryOrders, annualOrders } from "./machinery-orders";

describe("calendar-year machinery orders", () => {
  it("includes six complete calendar years and eight months of 2026", () => {
    expect(annualOrders.map(point => point.year)).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    for (const point of annualOrders) {
      expect(point.domestic + point.exports).toBe(point.total);
      const months = orders.points.filter(month => month.month.startsWith(`${point.year}-`) && Number(month.month.slice(5)) <= point.months);
      expect(months).toHaveLength(point.year === 2026 ? 8 : 12);
      expect(point.total).toBe(months.reduce((sum, month) => sum + month.total, 0));
    }
    expect(annualOrders[0].total).toBe(4602231);
    expect(annualOrders[5].total).toBe(7344519);
    expect(annualOrders[6].label).toBe("2026年1～8月（8か月分）");
    expect(annualOrders[6].total).toBe(5486891);
  });

  it("rejects missing or duplicated months rather than showing partial annual totals", () => {
    expect(() => annualMachineryOrders(orders.points.filter(point => point.month !== "2020-01"))).toThrow("Incomplete calendar year: 2020");
    const january = orders.points.find(point => point.month === "2020-01")!;
    expect(() => annualMachineryOrders([...orders.points, january])).toThrow("Incomplete calendar year: 2020");
  });

  it("rejects inconsistent domestic/export amounts", () => {
    const points = orders.points.map(point => point.month === "2025-12" ? { ...point, domestic: point.domestic + 1 } : point);
    expect(() => annualMachineryOrders(points)).toThrow("Inconsistent orders: 2025");
  });
});
