import snapshot from "./data/core-inflation.json";

export const coreInflationData = snapshot;
export const inflationSeries = [
  { id: "core", label: "生鮮食品・特殊要因を除く", color: "#be123c" },
  { id: "trimmedMean", label: "刈込平均値", color: "#d97706" },
  { id: "weightedMedian", label: "加重中央値", color: "#0f766e" },
  { id: "mode", label: "最頻値", color: "#7c3aed" },
  { id: "jgb10", label: "国債10年（年末）", color: "#0284c7" },
  { id: "jgb30", label: "国債30年（年末）", color: "#475569" },
  { id: "flat35", label: "フラット35・中間値（年末）", color: "#a16207" },
] as const;

type RateReport = {
  asOf: string;
  periods: string[];
  series: { id: string; values: (number | null)[]; sourceIds: string[] }[];
};

export function annualInflationRows(report: RateReport, years: number) {
  const observations = snapshot.observations.filter(row => row.year < Number(report.asOf.slice(0, 4)));
  const latest = observations.at(-1)?.year;
  if (latest === undefined) return [];
  return observations.filter(row => row.year >= latest - years + 1).map(row => {
    const index = report.periods.indexOf(`${row.year}-12-31`);
    const rate = (id: string) => index < 0 ? null : report.series.find(series => series.id === id)?.values[index] ?? null;
    return { ...row, jgb10: rate("jgb10"), jgb30: rate("jgb30"), flat35: rate("flat35") };
  });
}
