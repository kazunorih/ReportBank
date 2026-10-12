import { afterEach, describe, expect, it, vi } from "vitest";
import { seriesCatalog } from "@/lib/reports/catalog";
import { reportSchema, summarySchema } from "@/lib/reports/schema";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/aws/clients", () => ({ dynamoClient: { send } }));
import { getWeeklyReports } from "@/lib/reports/store";
import { getMarketChart } from "@/lib/reports/markets";

function reportFixture() {
  // Synthetic values exclusively for validation tests; never imported by the app.
  return {
    schemaVersion: 1, date: "2026-10-09", asOf: "2026-10-09", generatedAt: "2026-10-09T14:05:00Z",
    summary: "テスト用の整理", model: "gpt-5.6-luna",
    periods: Array.from({ length: 60 }, (_, index) => `${1996 + Math.floor((index + 1) / 2)}-${index % 2 ? "06-30" : "12-31"}`),
    series: seriesCatalog.map((s) => ({ id: s.id, values: Array(60).fill(null), sourceIds: ["source"], latestDate: null, note: "テスト" })),
    sources: [{ id: "source", name: "資料", url: "https://www.boj.or.jp/", retrievedAt: "2026-10-09T14:00:00Z" }],
    warnings: [],
  };
}

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("weekly reports", () => {
  it("serves the sourced first-chart snapshot without AWS or an AI summary", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "");
    const chart = await getMarketChart();
    expect(chart.series).toHaveLength(4);
    expect(chart.series.some((item) => item.id === "jgb3")).toBe(false);
    expect(chart.insight?.summary.length).toBeGreaterThan(0);
    expect([...(chart.insight?.summary || "")].length).toBeLessThanOrEqual(400);
    expect(chart.series.find((item) => item.id === "topix")?.values.some((value) => value !== null && value > 0)).toBe(true);
    expect(chart.sources.some((source) => source.url === "https://www.jpx.co.jp/markets/indices/topix/" && source.name.includes("指数値の推移"))).toBe(true);
    const topix = chart.series.find((item) => item.id === "topix")!;
    expect(topix.values.filter((value) => value !== null)).toHaveLength(30);
    expect(topix.values[chart.periods.indexOf("2025-12-31")]).toBe(3408.97);
    expect(topix.values.every((value, i) => value === null || chart.periods[i].endsWith("-12-31"))).toBe(true);
    expect(topix.values.at(-1)).toBeNull();
    const flat35 = chart.series.find((item) => item.id === "flat35")!;
    expect(flat35.values.filter((value) => value !== null).length).toBeGreaterThan(1);
    expect(flat35.note).toContain("（最高＋最低）÷2");
    expect(flat35.values[chart.periods.indexOf("2026-06-30")]).toBe(4.345);
    expect(chart.sources.filter((source) => flat35.sourceIds.includes(source.id)).every((source) => ["www.flat35.com", "www.simulation.jhf.go.jp"].includes(new URL(source.url).hostname))).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("reads the independently published chart and does not mask AWS errors", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "reports");
    send.mockRejectedValueOnce(new Error("unavailable"));
    await expect(getMarketChart()).rejects.toThrow("unavailable");
    expect(send.mock.calls[0][0].input).toMatchObject({ Key: { pk: "CHART", sk: "MARKETS" }, ConsistentRead: true });
  });

  it("does not relabel the previously stored bank rates as JHF midpoints", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "reports");
    send.mockResolvedValueOnce({ Item: { chart: { series: [{ id: "flat35", values: [1.23] }] } } });
    const chart = await getMarketChart();
    expect(chart.flat35Method).toBe("range-midpoint-v1");
    expect(chart.series.find((item) => item.id === "flat35")?.values.at(-1)).toBe(4.345);
  });

  it("replaces cached monthly TOPIX with the annual workbook definition", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "reports");
    send.mockResolvedValueOnce({ Item: { chart: { flat35Method: "range-midpoint-v1" } } });
    expect((await getMarketChart()).topixMethod).toBe("annual-close-v1");
  });

  it("rejects an old Nikkei report instead of relabelling its values as TOPIX", () => {
    const report = reportFixture();
    expect(reportSchema.safeParse(report).success).toBe(true);
    const oldSeries = report.series.map((series) => series.id === "topix" ? { ...series, id: "nikkei225" } : series);
    expect(reportSchema.safeParse({ ...report, series: oldSeries }).success).toBe(false);
  });

  it("rejects duplicate series, invalid model, overlong text and unsafe source URLs", () => {
    const report = reportFixture();
    expect(reportSchema.safeParse(report).success).toBe(true);
    expect(reportSchema.safeParse({ ...report, model: "other" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, summary: "あ".repeat(401) }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, series: Array(13).fill(report.series[0]) }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, sources: [{ ...report.sources[0], url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, periods: Array(60).fill("2026-06-30") }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, sources: [] }).success).toBe(false);
    expect(summarySchema.safeParse({ ...report, summary: "😀".repeat(400) }).success).toBe(true);
  });

  it("shows an unconfigured empty state without calling AWS", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "");
    expect((await getWeeklyReports()).report).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("queries paginated immutable history with a consistent read and flags stale reports", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "reports");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    const report = reportFixture();
    send.mockResolvedValueOnce({ Item: { report } }).mockResolvedValueOnce({ Items: [report], LastEvaluatedKey: { pk: "HISTORY", sk: "2026-09-04" } });
    const result = await getWeeklyReports("2026-10-02");
    expect(result.stale).toBe(true);
    expect(result.history).toHaveLength(1);
    expect(result.nextCursor).toBe("2026-09-04");
    expect(send.mock.calls[1][0].input).toMatchObject({
      ConsistentRead: true, ScanIndexForward: false, Limit: 20,
      ExpressionAttributeValues: { ":pk": "HISTORY", ":before": "2026-10-02" },
    });
  });

  it("does not hide AWS errors as a successful empty history", async () => {
    vi.stubEnv("WEEKLY_REPORTS_TABLE_NAME", "reports");
    send.mockRejectedValue(new Error("AccessDenied"));
    await expect(getWeeklyReports()).rejects.toThrow("AccessDenied");
  });
});
