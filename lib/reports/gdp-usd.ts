import gdp from "./data/gdp.json";
import totals from "./data/gdp-totals.json";
import exchange from "./data/gdp-usd-exchange.json";

// The source GDP unit is billion JPY; chart values are trillion USD.
export function trillionUsd(billionYen: number, yenPerUsd: number) {
  if (!Number.isFinite(billionYen) || !Number.isFinite(yenPerUsd) || yenPerUsd <= 0) throw new Error("Invalid GDP or exchange rate");
  return billionYen / yenPerUsd / 1_000;
}

export const usdGdpSeries = [...gdp.series, { key: "other", name: "その他" }];
export const usdGdpData = [
  ...gdp.points.map(point => ({ year: point.year, nominal: point.total, breakdown: point as Record<string, number> })),
  ...totals.points.filter(point => point.year > gdp.latestYear).map(point => ({ year: point.year, nominal: point.nominal, breakdown: null })),
].map(point => {
  const rate = exchange.points.find(rate => rate.year === point.year);
  if (!rate) throw new Error(`Missing annual average JPY/USD: ${point.year}`);
  const row: Record<string, number | null> = { year: point.year, yenPerUsd: rate.yenPerUsd,
    total: trillionUsd(point.nominal, rate.yenPerUsd),
    nominalOnly: point.breakdown ? null : trillionUsd(point.nominal, rate.yenPerUsd) };
  for (const series of usdGdpSeries) row[series.key] = point.breakdown ? trillionUsd(point.breakdown[series.key], rate.yenPerUsd) : null;
  return row;
});
