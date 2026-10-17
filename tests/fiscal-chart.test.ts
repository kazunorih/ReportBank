import { expect, it } from "vitest";
import snapshot from "@/lib/reports/data/markets.json";
import { marketChartSchema } from "@/lib/reports/schema";

it("preserves thirty years of sourced debt and initial-budget interest", () => {
  const chart = marketChartSchema.parse(snapshot);
  const fiscal = chart.fiscal!;
  expect(fiscal.debt).toHaveLength(60);
  expect(fiscal.debt[0]).toMatchObject({ date: "1996-12-31", amount: 343.6817 });
  expect(fiscal.debt.at(-1)).toMatchObject({ date: "2026-06-30", amount: 1346.6833 });
  expect(fiscal.budgets).toHaveLength(50);
  expect(fiscal.budgets[0]).toMatchObject({ fiscalYear: 1977, interest: 1.9316, budget: 28.5143 });
  expect(fiscal.budgets.at(-1)).toMatchObject({ fiscalYear: 2026, interest: 13.037146231, budget: 122.309247035 });
  for (const row of fiscal.budgets) expect(row.share).toBeCloseTo(row.interest / row.budget * 100, 8);
  expect(chart.insight!.summary).toContain("民間金融機関");
  expect([...chart.insight!.summary].length).toBeLessThanOrEqual(400);
});

it("rejects wrong shares, unknown sources, future observations and missing fourth-figure evidence", () => {
  const bad = structuredClone(snapshot);
  bad.fiscal.budgets[0].share += 1;
  expect(marketChartSchema.safeParse(bad).success).toBe(false);
  bad.fiscal = structuredClone(snapshot.fiscal);
  bad.fiscal.debt[0].sourceIds = ["unknown"];
  expect(marketChartSchema.safeParse(bad).success).toBe(false);
  bad.fiscal = structuredClone(snapshot.fiscal);
  bad.fiscal.debt[0].date = "2099-12-31";
  expect(marketChartSchema.safeParse(bad).success).toBe(false);
  expect(marketChartSchema.safeParse({ ...snapshot, fiscal: undefined }).success).toBe(false);
});
