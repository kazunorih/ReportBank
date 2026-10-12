import type { MarketChart } from "./schema";
import { withLendingChart } from "./lending";

export const bojSeriesCatalog = [
  { id: "bojStatementJgb", label: "日本国債", unit: "兆円", group: "bojComparison" },
  { id: "bojOtherAssets", label: "その他資産", unit: "兆円", group: "bojComparison" },
] as const;

export function withReportFigures(market: MarketChart) {
  const report = withLendingChart(market);
  const financials = market.bojFinancials;
  const rows = financials?.observations.filter(row => row.date <= market.asOf) ?? [];
  const series = bojSeriesCatalog.map(item => ({
    id: item.id, values: market.periods.map(() => null),
    observations: rows.map(row => ({ date: row.date, value: item.id === "bojStatementJgb" ? row.jgb : row.other })),
    sourceIds: [...new Set(rows.flatMap(row => row.sourceIds))],
    latestDate: rows.at(-1)?.date ?? null,
    note: item.id === "bojStatementJgb" ? "日本銀行の財務諸表の「国債」。短期・長期を含み、政府債務全体ではありません。" : "財務諸表の資産合計から国債を差し引いた金額。貸出金、ETF等を含み、勘定科目「その他資産」とは異なります。",
  }));
  return { ...report, series: [...report.series, ...series], sources: [...new Map([...report.sources, ...(financials?.sources ?? [])].map(s => [s.id, s])).values()] };
}
