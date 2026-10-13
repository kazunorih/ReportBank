import { expect, it } from "vitest";
import { chartScale } from "@/lib/reports/chart-scale";

it("keeps negative rates and a zero baseline within the shared axis range", () => {
  const scale = chartScale([-0.3, null, 3.354, undefined]);
  expect(scale.domain[0]).toBeLessThanOrEqual(-0.3);
  expect(scale.domain[1]).toBeGreaterThanOrEqual(3.354);
  expect(scale.ticks).toContain(0);
  expect(scale.ticks[0]).toBe(scale.domain[0]);
  expect(scale.ticks.at(-1)).toBe(scale.domain[1]);
});

it("provides finite increasing scales for missing, zero and large amounts", () => {
  for (const values of [[null, undefined], [0, 0], [1346.6833], [0.001, 0.002]]) {
    const scale = chartScale(values);
    expect(scale.domain[1]).toBeGreaterThan(scale.domain[0]);
    expect(scale.ticks.every(Number.isFinite)).toBe(true);
    for (let i = 1; i < scale.ticks.length; i++) expect(scale.ticks[i]).toBeGreaterThan(scale.ticks[i - 1]);
    for (const value of values) if (value != null) expect(value).toBeLessThanOrEqual(scale.domain[1]);
  }
});
