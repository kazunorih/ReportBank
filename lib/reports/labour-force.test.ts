import { describe, expect, it } from "vitest";
import labour from "./data/labour-force.json";

describe("monthly Labour Force Survey", () => {
  it("covers consecutive months from January 2001 to the latest release", () => {
    const count = (Number(labour.latestMonth.slice(0, 4)) - 2001) * 12 + Number(labour.latestMonth.slice(5));
    expect(labour.points.map(point => point.month)).toEqual(Array.from({ length: count }, (_, i) => `${2001 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`));
    expect(labour.unit).toBe("万人");
    expect(labour.categories).toHaveLength(5);
    expect(labour.rankingMonth).toBe(labour.latestMonth);
    const latest = labour.points.at(-1)!;
    expect(latest.values).toEqual([...latest.values].sort((a, b) => Number(b) - Number(a)));
  });

  it("reconciles employment breakdowns while retaining published labour force differences", () => {
    for (const point of labour.points) {
      expect(point.reconciliationGap).toBe(point.labourForce - point.employed - point.unemployed);
      expect(Math.abs(point.reconciliationGap)).toBeLessThanOrEqual(3);
      expect(point.unemployed).toBeGreaterThanOrEqual(0);
      if (point.month < "2002-01") {
        expect(point.values.every(value => value === null)).toBe(true);
        expect(point.other).toBeNull();
        expect(point.employedOnly).toBe(point.employed);
      } else {
        expect(point.values.every(value => value !== null && value >= 0)).toBe(true);
        expect(point.other).toBeGreaterThanOrEqual(0);
        expect(point.values.reduce<number>((sum, value) => sum + Number(value), 0) + Number(point.other)).toBe(point.employed);
      }
    }
  });

  it("matches official September 2026 headline figures and flags earthquake estimates", () => {
    expect(labour.points.find(point => point.month === "2026-09")).toMatchObject({ employed: 6896, unemployed: 169, labourForce: 7064 });
    expect(labour.points.filter(point => point.supplementaryEstimate)).toHaveLength(6);
    expect(labour.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
  });
});
