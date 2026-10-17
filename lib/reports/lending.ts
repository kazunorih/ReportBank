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
    domesticCorporateLoans: z.number().finite().nonnegative().nullable(),
  })),
  source: reportSchema.shape.sources.element,
  corporateSource: reportSchema.shape.sources.element,
}).parse(snapshot);

export function withLendingChart(market: MarketChart) {
  const data = market.lending ?? lending;
  const rows = data.observations.map((row) => ({
    ...row,
    unclassifiedLoans: row.domesticBankLoans !== null && row.housingLoans !== null && row.domesticCorporateLoans === null
      ? (Math.round(row.domesticBankLoans * 10000) - Math.round(row.housingLoans * 10000)) / 10000 : null,
    otherLoans: row.domesticBankLoans === null || row.housingLoans === null || row.domesticCorporateLoans === null ? null
      : (Math.round(row.domesticBankLoans * 10000) - Math.round(row.housingLoans * 10000) - Math.round(row.domesticCorporateLoans * 10000)) / 10000,
  }));
  const observations = new Map(rows.map((row) => [row.date, row]));
  const series = lendingSeriesCatalog.map((item) => ({
    id: item.id,
    values: market.periods.map((period) => observations.get(period)?.[item.id] ?? null),
    sourceIds: [data.source.id, data.corporateSource.id],
    latestDate: rows.filter((row) => row.date <= market.asOf && row[item.id] !== null).at(-1)?.date ?? null,
    note: `国内銀行の銀行勘定・信託勘定・海外店勘定の合計。四半期末残高から各年6月・12月を採用し、億円を兆円に換算。${item.id === "unclassifiedLoans" ? "法人向け系列が始まる1993年6月より前は、総貸出から住宅資金を差し引いた額を表示。法人向けとそれ以外には分割していません。" : item.id === "housingLoans" ? "個人向け住宅資金の貸出残高です。" : item.id === "domesticCorporateLoans" ? "日銀の「法人計〈含金融〉」。金融業・個人企業を含みます。" : "総貸出残高から住宅資金と法人向けを差し引いた額。住宅資金以外の個人向け、地方公共団体、海外円借款等を含みます。"}`,
  }));
  return { ...market, series: [...market.series, ...series], sources: [...new Map([...market.sources, data.source, data.corporateSource].map(s => [s.id, s])).values()] };
}
