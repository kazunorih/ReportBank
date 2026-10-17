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

export const fiscalSchema = z.object({
  debt: z.array(z.object({ date, amount: z.number().finite().positive(), sourceIds: z.array(z.string()).min(1) })).min(1).max(100),
  budgets: z.array(z.object({
    fiscalYear: z.number().int(), interest: z.number().finite().positive(), budget: z.number().finite().positive(),
    share: z.number().finite().positive().max(100), basis: z.literal("initial-budget"), sourceIds: z.array(z.string()).min(1),
  }).refine(row => row.interest < row.budget && Math.abs(row.share - row.interest / row.budget * 100) < 1e-8)).min(1).max(50),
  sources: reportSchema.shape.sources,
});
export type FiscalData = z.infer<typeof fiscalSchema>;

export const marketChartSchema = z.object({
  summaryScope: z.literal("four-figures-v6").optional(),
  fiscal: fiscalSchema.optional(),
  lending: z.object({
    observations: z.array(z.object({ date, domesticBankLoans: z.number().finite().nonnegative().nullable(), housingLoans: z.number().finite().nonnegative().nullable(), domesticCorporateLoans: z.number().finite().nonnegative().nullable() })),
    source: reportSchema.shape.sources.element,
    corporateSource: reportSchema.shape.sources.element,
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
  periods: z.array(date).length(100),
  series: z.array(reportSchema.shape.series.element.extend({ values: z.array(z.number().finite().nullable()).length(100) })).transform((items) => items.filter((item) => item.id !== "jgb3")).pipe(z.array(reportSchema.shape.series.element.extend({ values: z.array(z.number().finite().nullable()).length(100) })).length(4)),
  sources: reportSchema.shape.sources,
  warnings: reportSchema.shape.warnings,
  insight: z.object({
    summary: summarySchema.shape.summary,
    generatedAt: summarySchema.shape.generatedAt,
    model: z.enum(["initial", "gpt-5.6-luna"]),
  }).optional(),
}).superRefine((chart, ctx) => {
  if (chart.summaryScope === "four-figures-v6") {
    const financials = chart.bojFinancials;
    const sources = new Set(chart.sources.map(source => source.id));
    if (!financials || !chart.lending || !chart.fiscal || financials.observations.length === 0 ||
        financials.observations.some((row, index) => row.date > chart.asOf ||
          (index > 0 && row.date <= financials.observations[index - 1].date) || row.sourceIds.some(id => !sources.has(id))) ||
        !sources.has(chart.lending.source.id) || !sources.has(chart.lending.corporateSource.id) || chart.lending.observations.some(row =>
          row.date > chart.asOf || (row.housingLoans !== null && row.domesticBankLoans !== null && Math.round(row.housingLoans * 10000) + Math.round((row.domesticCorporateLoans ?? 0) * 10000) > Math.round(row.domesticBankLoans * 10000)))) {
      ctx.addIssue({ code: "custom", message: "Invalid integrated figure evidence" });
    }
    const fiscal = chart.fiscal;
    const currentFy = Number(chart.asOf.slice(0, 4)) - (Number(chart.asOf.slice(5, 7)) < 4 ? 1 : 0);
    if (fiscal && (fiscal.debt.some((row, index) => !chart.periods.includes(row.date) || (index > 0 && row.date <= fiscal.debt[index - 1].date)) ||
        fiscal.budgets.some((row, index) => row.fiscalYear > currentFy || row.fiscalYear < currentFy - 49 || (index > 0 && row.fiscalYear <= fiscal.budgets[index - 1].fiscalYear)) ||
        [...fiscal.debt, ...fiscal.budgets].some(row => row.sourceIds.some(id => !sources.has(id) || !fiscal.sources.some(s => s.id === id))))) {
      ctx.addIssue({ code: "custom", message: "Invalid fiscal dates or sources" });
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
