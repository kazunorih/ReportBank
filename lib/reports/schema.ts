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
