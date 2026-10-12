import { z } from "zod";
import { seriesCatalog } from "./catalog";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:");
export const summarySchema = z.object({
  date,
  generatedAt: z.string().datetime(),
  summary: z.string().min(1).refine((text) => [...text].length <= 400),
  model: z.literal("gpt-5.6-luna"),
});
export const reportSchema = summarySchema.extend({
  schemaVersion: z.literal(1),
  asOf: date,
  periods: z.array(date).length(60),
  series: z.array(z.object({
    id: z.enum(seriesCatalog.map((series) => series.id)),
    values: z.array(z.number().finite().nullable()).length(60),
    sourceIds: z.array(z.string()),
    latestDate: date.nullable(),
    note: z.string(),
  })).length(seriesCatalog.length).refine((series) => new Set(series.map((s) => s.id)).size === seriesCatalog.length),
  sources: z.array(z.object({
    id: z.string(), name: z.string(), url: httpsUrl,
    retrievedAt: z.string().datetime(),
  })),
  warnings: z.array(z.string()),
}).superRefine((report, ctx) => {
  if (report.periods.some((period, index) =>
    !/(?:06-30|12-31)$/.test(period) || period > report.asOf ||
    (index > 0 && period <= report.periods[index - 1]))) {
    ctx.addIssue({ code: "custom", message: "Invalid half-year sequence", path: ["periods"] });
  }
  const sourceIds = new Set(report.sources.map((source) => source.id));
  if (report.series.some((series) => series.sourceIds.some((id) => !sourceIds.has(id)))) {
    ctx.addIssue({ code: "custom", message: "Unknown statistical source", path: ["sources"] });
  }
});
export type WeeklyReport = z.infer<typeof reportSchema>;
export type ReportSummary = z.infer<typeof summarySchema>;

export const marketChartSchema = z.object({
  summaryScope: z.literal("three-figures-v1").optional(),
  lending: z.object({
    observations: z.array(z.object({ date, domesticBankLoans: z.number().finite().nonnegative().nullable(), housingLoans: z.number().finite().nonnegative().nullable() })),
    source: reportSchema.shape.sources.element,
  }).optional(),
  bojFinancials: z.object({
    observations: z.array(z.object({
      date: z.string().regex(/^\d{4}-(03-31|09-30)$/),
      assets: z.number().finite().nonnegative(), jgb: z.number().finite().nonnegative(), other: z.number().finite().nonnegative(),
      sourceIds: z.array(z.string()), basis: z.literal("financial-statements"),
    }).refine(row => Math.abs(row.assets - row.jgb - row.other) < 0.00001)),
    sources: reportSchema.shape.sources,
  }).optional(),
  topixMethod: z.literal("annual-close-v1"),
  flat35Method: z.literal("range-midpoint-v1"),
  asOf: date,
  periods: reportSchema.shape.periods,
  series: z.array(reportSchema.shape.series.element).transform((items) => items.filter((item) => item.id !== "jgb3")).pipe(z.array(reportSchema.shape.series.element).length(4)),
  sources: reportSchema.shape.sources,
  warnings: reportSchema.shape.warnings,
  insight: z.object({
    summary: summarySchema.shape.summary,
    generatedAt: summarySchema.shape.generatedAt,
    model: z.enum(["initial", "gpt-5.6-luna"]),
  }).optional(),
}).superRefine((chart, ctx) => {
  if (chart.summaryScope === "three-figures-v1") {
    const financials = chart.bojFinancials;
    const sources = new Set(chart.sources.map(source => source.id));
    if (!financials || !chart.lending || financials.observations.length === 0 ||
        financials.observations.some((row, index) => row.date > chart.asOf ||
          (index > 0 && row.date <= financials.observations[index - 1].date) || row.sourceIds.some(id => !sources.has(id))) ||
        !sources.has(chart.lending.source.id) || chart.lending.observations.some(row =>
          row.date > chart.asOf || (row.housingLoans !== null && row.domesticBankLoans !== null && row.housingLoans > row.domesticBankLoans))) {
      ctx.addIssue({ code: "custom", message: "Invalid integrated figure evidence" });
    }
  }
  const required = ["jgb10", "jgb30", "flat35", "topix"];
  const ids = new Set(chart.series.map((item) => item.id));
  const sources = new Set(chart.sources.map((item) => item.id));
  if (!required.every((id) => ids.has(id as (typeof chart.series)[number]["id"])) ||
      chart.series.some((item) => item.sourceIds.some((id) => !sources.has(id))) ||
      chart.periods.some((period, index) => !/(?:06-30|12-31)$/.test(period) || period > chart.asOf || (index > 0 && period <= chart.periods[index - 1]))) {
    ctx.addIssue({ code: "custom", message: "Invalid market chart" });
  }
});
export type MarketChart = z.infer<typeof marketChartSchema>;
