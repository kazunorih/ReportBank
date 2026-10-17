import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import snapshot from "@/lib/reports/data/household.json";
import { householdSchema } from "@/lib/reports/schema";
import HouseholdChart from "@/app/weekly-reports/household-chart";

vi.mock("recharts", () => ({
  ResponsiveContainer: () => null, Bar: () => null, CartesianGrid: () => null,
  ComposedChart: () => null, Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

it("aligns income to the previous calendar year and preserves cancelled-survey gaps", () => {
  const data = householdSchema.parse(snapshot);
  expect(data.observations).toHaveLength(31);
  expect(data.observations[0]).toMatchObject({ year: 1995, surveyYear: 1996, averageIncome: 659.6, belowMeanShare: 60, unemploymentRate: 3.2 });
  expect(data.observations.find(r => r.year === 2019)).toMatchObject({ averageIncome: null, belowMeanShare: null, unemploymentRate: 2.4 });
  expect(data.observations.find(r => r.year === 2024)).toMatchObject({ surveyYear: 2025, averageIncome: 575.2, belowMeanShare: 61.5, unemploymentRate: 2.5 });
  expect(data.observations.at(-1)).toMatchObject({ year: 2025, averageIncome: null, unemploymentRate: 2.5 });
});

it("rejects survey-year shifts and missing provenance", () => {
  const bad = structuredClone(snapshot);
  bad.observations[0].surveyYear = 1995;
  expect(householdSchema.safeParse(bad).success).toBe(false);
  bad.observations[0].surveyYear = 1996;
  bad.observations[0].incomeSourceIds = ["unknown"];
  expect(householdSchema.safeParse(bad).success).toBe(false);
});

it("renders fixed percent ticks on the left and income ticks without percent on the right", () => {
  const html = renderToStaticMarkup(<HouseholdChart data={householdSchema.parse(snapshot)} years={50} />);
  expect(html).toContain("FIGURE 05");
  expect(html).toContain("1995年");
  expect(html).toContain("2025年");
  const axes = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
  expect(axes).toHaveLength(2);
  expect(axes[0]).toContain("%");
  expect(axes[1]).not.toContain("%");
  expect(html).toContain("万円");
  expect(html).toContain("data-fixed-axis-chart");
});
