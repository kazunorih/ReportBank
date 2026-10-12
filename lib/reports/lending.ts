import { z } from "zod";
import snapshot from "./data/lending.json";
import { reportSchema, type MarketChart } from "./schema";
import { lendingSeriesCatalog } from "./catalog";

const lending = z.object({
  unit: z.literal("兆円"),
  observations: z.array(z.object({
    date: z.string().regex(/^\d{4}-(03-31|06-30|09-30|12-31)$/),
    domesticBankLoans: z.number().finite().nonnegative().nullable(),
    housingLoans: z.number().finite().nonnegative().nullable(),
  })),
  source: reportSchema.shape.sources.element,
}).parse(snapshot);

export function withLendingChart(market: MarketChart) {
  const data = market.lending ?? lending;
  const rows = data.observations.map((row) => ({
    ...row,
    otherLoans: row.domesticBankLoans === null || row.housingLoans === null ? null
      : (Math.round(row.domesticBankLoans * 10000) - Math.round(row.housingLoans * 10000)) / 10000,
  }));
  const observations = new Map(rows.map((row) => [row.date, row]));
  const series = lendingSeriesCatalog.map((item) => ({
    id: item.id,
    values: market.periods.map((period) => observations.get(period)?.[item.id] ?? null),
    sourceIds: [data.source.id],
    latestDate: rows.filter((row) => row.date <= market.asOf && row[item.id] !== null).at(-1)?.date ?? null,
    note: `国内銀行の銀行勘定・信託勘定・海外店勘定の合計。四半期末残高から各年6月・12月を採用し、億円を兆円に換算。${item.id === "housingLoans" ? "個人向け住宅資金の貸出残高です。" : "総貸出残高から住宅資金を差し引いた額で、法人向け貸出だけを表すものではありません。"}`,
  }));
  return { ...market, series: [...market.series, ...series], sources: [...new Map([...market.sources, data.source].map(s => [s.id, s])).values()] };
}
