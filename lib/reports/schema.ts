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
