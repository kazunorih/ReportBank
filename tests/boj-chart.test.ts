import { expect, it } from "vitest";
import snapshot from "@/lib/reports/data/markets.json";
import { marketChartSchema } from "@/lib/reports/schema";
import { withReportFigures } from "@/lib/reports/boj";

it("keeps fiscal statement dates, the asset identity and unchanged interest series", () => {
  const market = marketChartSchema.parse(snapshot);
  const report = withReportFigures(market);
  for (const id of ["jgb10", "jgb30", "flat35"]) expect(report.series.find(s => s.id === id)).toBe(market.series.find(s => s.id === id));
  const rows = market.bojFinancials!.observations;
  expect(rows).toHaveLength(14);
  expect(rows[0].date).toBe("2019-09-30");
  expect(rows.at(-1)).toMatchObject({ date: "2026-03-31", assets: 663.025, jgb: 530.8695, other: 132.1555 });
  for (const row of rows) {
    expect(row.jgb + row.other).toBeCloseTo(row.assets, 8);
    expect(row.date).toMatch(/-(03-31|09-30)$/);
  }
  const assets = report.series.find(s => s.id === "bojStatementJgb")!;
  expect(assets.values.every(v => v === null)).toBe(true); // Never shift March onto June.
  expect(market.insight!.summary).toMatch(/分からない|判断できない|不明/);
  expect([...market.insight!.summary].length).toBeLessThanOrEqual(400);
});

it("rejects mislabeled asset totals or missing integrated evidence", () => {
  const bad = structuredClone(snapshot);
  bad.bojFinancials.observations[0].other += 1;
  expect(marketChartSchema.safeParse(bad).success).toBe(false);
  expect(marketChartSchema.safeParse({ ...snapshot, bojFinancials: undefined }).success).toBe(false);
});
