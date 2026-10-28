import { describe, expect, it } from "vitest";
import { productionData } from "./production";

describe("official production series", () => {
  it("preserves consecutive coverage and published agricultural totals", () => {
    const points = productionData.agriculture;
    expect(points.map(p => p.year)).toEqual(Array.from({ length: 50 }, (_, i) => 1975 + i));
    for (const p of points) {
      expect(p.rice + p.vegetables + p.livestock + p.other).toBe(p.total);
      expect(Math.min(p.rice, p.vegetables, p.livestock, p.other)).toBeGreaterThanOrEqual(0);
    }
    expect(points.at(-1)).toMatchObject({ year: 2024, total: 107801, rice: 25524, vegetables: 25510, livestock: 36654 });
  });
  it("keeps fiscal self-sufficiency separate from calendar-year output", () => {
    expect(productionData.selfSufficiency[0]).toMatchObject({ year: 1975, rate: 54 });
    expect(productionData.selfSufficiency.at(-1)).toEqual({ year: 2025, rate: 37, provisional: true });
    expect(productionData.agriculture.some(p => p.year === 2025)).toBe(false);
    for (const p of productionData.selfSufficiency) expect(p.rate).toBeGreaterThanOrEqual(0);
  });
  it("uses nominal GDP amounts, not the PDF's rounded composition ratios", () => {
    expect(productionData.industry.map(p => p.year)).toEqual(Array.from({ length: 31 }, (_, i) => 1994 + i));
    expect(productionData.industry.at(-1)).toMatchObject({ year: 2024, mining: 355.3, manufacturing: 119345.1, construction: 33514.2 });
    for (const p of productionData.industry) expect(p.mining + p.manufacturing + p.construction).toBeCloseTo(p.total, 1);
  });
});
