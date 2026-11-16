import { describe, expect, it } from "vitest";
import data from "./data/construction-work.json";

describe("construction survey annual PDF data", () => {
  it("covers every fiscal year from 2004 through the latest published year", () => {
    expect(data.points.map(p => p.year)).toEqual(Array.from({ length: 21 }, (_, i) => 2004 + i));
    expect(data.sources.map(p => p.year)).toEqual(data.points.map(p => p.year));
  });

  it("reconciles rounded amounts and calculates maintenance against published total", () => {
    for (const point of data.points) {
      expect(Math.abs(point.newConstruction + point.maintenance - point.total)).toBeLessThanOrEqual(1);
      expect(point.maintenanceRatio).toBeCloseTo(point.maintenance / point.total * 100, 10);
      expect(point.workers).toBeGreaterThan(0);
      expect(point.completed).toBeGreaterThanOrEqual(point.total);
    }
  });

  it("matches the first and latest overview PDF tables, retaining their original units", () => {
    expect(data.points[0]).toMatchObject({ year: 2004, newConstruction: 434813, maintenance: 127006, total: 561819, workers: 3659, completed: 912213 });
    expect(data.points.at(-1)).toMatchObject({ year: 2024, newConstruction: 626178, maintenance: 281459, total: 907638, workers: 4884, completed: 1544953 });
    // 億円 / 千人 * 10 = 万円 / 人; avoid a factor-of-ten unit error.
    expect(data.points.at(-1)!.completed / data.points.at(-1)!.workers * 10).toBeCloseTo(3163.2944, 4);
    for (const source of data.sources) {
      expect(source.url).toMatch(/^https:\/\/www\.e-stat\.go\.jp\/stat-search\/file-download\?/);
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.workPage).toBeGreaterThan(0);
      expect(source.employmentPage).toBeGreaterThan(source.workPage);
      expect(source.completedPage).toBeGreaterThan(0);
      expect(source.completedPage).toBeLessThan(source.workPage);
    }
  });
});
