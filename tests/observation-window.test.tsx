import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import snapshot from "@/lib/reports/data/markets.json";
import { marketChartSchema } from "@/lib/reports/schema";
import { withReportFigures } from "@/lib/reports/boj";
import ReportCharts from "@/app/weekly-reports/report-charts";

// The scroll plot requires browser layout; verify the accessible date tables here.
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null, Bar: () => null, CartesianGrid: () => null,
  ComposedChart: () => null, LineChart: () => null, ReferenceLine: () => null, Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

it("defaults figures 01, 03, 04 to 50 years and keeps figure 02 at 30 years", () => {
  const html = renderToStaticMarkup(<ReportCharts report={withReportFigures(marketChartSchema.parse(snapshot))} />);
  const sections = html.split(/FIGURE\s*(?:<!-- -->)?\s*0[1-4]<\/p>/);
  expect(sections).toHaveLength(5);
  expect(sections[1]).toContain("1976年12月末");
  expect(sections[2]).not.toContain("1976-12-31");
  expect(sections[2]).toContain("1996-09-30");
  expect(sections[3]).toContain("1976-12-31");
  expect(sections[4]).toContain("1976-12-31");
  expect(sections[4]).toContain("1977");
  expect(html).toContain('value="50" selected=""');
});
