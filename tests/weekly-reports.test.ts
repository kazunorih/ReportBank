import { afterEach, describe, expect, it, vi } from "vitest";
import { seriesCatalog } from "@/lib/reports/catalog";
import { reportSchema, summarySchema } from "@/lib/reports/schema";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/aws/clients", () => ({ dynamoClient: { send } }));
import { getWeeklyReports } from "@/lib/reports/store";

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
