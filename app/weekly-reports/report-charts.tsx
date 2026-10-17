"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartScale } from "@/lib/reports/chart-scale";
import FixedAxisChart, { plotMargin, xAxisHeight } from "./fixed-axis-chart";
import { chartGroups, seriesCatalog, lendingSeriesCatalog } from "@/lib/reports/catalog";
import type { WeeklyReport, FiscalData, HouseholdData } from "@/lib/reports/schema";
import HouseholdChart from "./household-chart";
import FiscalChart from "./fiscal-chart";
import { bojSeriesCatalog } from "@/lib/reports/boj";

const colors = ["#0284c7", "#0f766e", "#7c3aed", "#d97706", "#be123c"];
const displayCatalog = [...seriesCatalog, ...lendingSeriesCatalog, ...bojSeriesCatalog];
type ChartSeriesId = (typeof displayCatalog)[number]["id"];
type ChartReport = Pick<WeeklyReport, "periods" | "sources"> & {
  asOf: string;
  fiscal?: FiscalData;
  household?: HouseholdData;
  series: (Omit<WeeklyReport["series"][number], "id"> & { id: ChartSeriesId; observations?: { date: string; value: number }[] })[];
};
export default function ReportCharts({ report }: { report: ChartReport }) {
  const [years, setYears] = useState(50);
  const halfYearData = report.periods.map((period, index): { period: string } & Record<ChartSeriesId, number | null> => ({
    period,
    ...Object.fromEntries(report.series.map((series) => [series.id, series.values[index]])) as Record<ChartSeriesId, number | null>,
  })).slice(-years * 2);
  return (
    <section aria-label="統計図表" className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-slate-500">FIGURE03は最大30年</span>
        <label className="text-sm text-slate-600">表示期間
          <select value={years} onChange={(event) => setYears(Number(event.target.value))} className="ml-3 rounded-lg border border-slate-300 bg-white p-2">
            {[50, 30, 10, 5].map((value) => <option key={value} value={value}>{value}年</option>)}
          </select>
        </label>
      </div>
      {chartGroups.filter((group) => displayCatalog.some((item) => item.group === group.id && report.series.some((stored) => stored.id === item.id))).map((group, groupIndex) => {
        const data = group.id === "bojComparison" ? report.periods.slice(-Math.min(years, 30) * 2).flatMap(period => {
          const quarter = period.slice(0, 4) + (period.endsWith("06-30") ? "-03-31" : "-09-30");
          return [quarter, period].map(date => ({ period: date, ...Object.fromEntries(report.series.map(stored => [stored.id,
            stored.observations ? stored.observations.find(row => row.date === date)?.value ?? null : halfYearData.find(row => row.period === date)?.[stored.id] ?? null,
          ])) as Record<ChartSeriesId, number | null> }));
        }) : halfYearData;
        const series = displayCatalog.filter((item) => item.id !== "jgb3" && report.series.some((stored) => stored.id === item.id) &&
          (item.group === group.id || ((group.id === "loanComparison" || group.id === "bojComparison") && item.unit === "%")));
        const hasRates = group.id === "markets" || group.id === "loanComparison" || group.id === "bojComparison";
        const available = series.filter((item) => data.some((row) => row[item.id] != null));
        const amounts = available.filter(item => item.unit !== "%");
        const stacked = group.id === "loanComparison" || group.id === "bojComparison";
        const amountScale = chartScale(data.flatMap(row => stacked ? [amounts.reduce((sum, item) => sum + (row[item.id] ?? 0), 0)] : amounts.map(item => row[item.id])));
        const rateScale = chartScale(data.flatMap(row => available.filter(item => item.unit === "%").map(item => row[item.id])));
        return (
          <section key={group.id} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
            <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE {String(groupIndex + 1).padStart(2, "0")}</p>
            <h3 className="mt-2 text-xl font-semibold">{group.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{group.description}</p>
            {available.length ? (
              <>
                <FixedAxisChart left={amountScale} right={hasRates ? rateScale : undefined} leftUnit={group.id === "markets" ? "ポイント" : "兆円"} rightUnit="金利（%）" minWidth={Math.max(600, (group.id === "bojComparison" ? Math.min(years, 30) : years) * 36 + 110)} height={384} label={`${group.title}。横軸は各年12月。数値は下のデータ表でも確認できます。`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={plotMargin} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="period" ticks={data.filter((row) => row.period.endsWith("-12-31")).map((row) => row.period)} interval={0}
                      angle={-55} textAnchor="end" height={xAxisHeight} tickMargin={8}
                      tickFormatter={(value: string) => `${value.slice(0, 4)}年12月`} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="amount" hide domain={amountScale.domain} ticks={amountScale.ticks} />
                    {hasRates && <YAxis yAxisId="rate" hide domain={rateScale.domain} ticks={rateScale.ticks} />}
                    <Tooltip labelFormatter={(value) => `${value} 観測日`}
                      formatter={(value, name) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 4 })} ${series.find((s) => s.label === name)?.unit || ""}`, name]} />
                    {available.map((item, index) => item.unit !== "%" && (group.id === "lending" || group.id === "loanComparison" || group.id === "bojComparison" || group.id === "construction" || item.id === "topix")
                      ? <Bar key={item.id} yAxisId="amount" dataKey={item.id} name={item.label} stackId={group.id === "loanComparison" || group.id === "bojComparison" ? group.id : undefined} fill={item.id === "unclassifiedLoans" ? "#cbd5e1" : item.id === "domesticCorporateLoans" ? "#93c5fd" : item.id === "housingLoans" ? "#d97706" : item.id === "otherLoans" ? "#be123c" : item.id === "topix" ? "#94a3b8" : colors[index]} fillOpacity={item.id === "topix" ? 0.5 : item.id === "otherLoans" || item.id === "bojOtherAssets" ? 0.3 : 1} maxBarSize={18} isAnimationActive={false} />
                      : <Line key={item.id} yAxisId={item.unit === "%" ? "rate" : "amount"} dataKey={item.id} name={item.label} stroke={colors[index]} strokeWidth={2} type="linear" dot={false} connectNulls={group.id === "bojComparison"} isAnimationActive={false} />)}
                  </ComposedChart>
                </ResponsiveContainer>
                </FixedAxisChart>
                <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs" aria-label="凡例">
                  {available.map((item, index) => <li key={item.id} style={{ color: item.id === "unclassifiedLoans" ? "#cbd5e1" : item.id === "domesticCorporateLoans" ? "#93c5fd" : item.id === "housingLoans" ? "#d97706" : item.id === "otherLoans" ? "#be123c" : item.id === "topix" ? "#94a3b8" : colors[index] }}><span aria-hidden="true" style={{ opacity: item.id === "topix" ? 0.5 : item.id === "otherLoans" || item.id === "bojOtherAssets" ? 0.3 : 1 }}>{item.unit === "%" ? "━" : "■"}</span> {item.label}</li>)}
                </ul>
              </>
            ) : <p className="my-12 text-center text-sm text-slate-500">この期間の公表データはまだ取り込まれていません。</p>}
            <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
              {series.map((item) => {
                const stored = report.series.find((s) => s.id === item.id)!;
                return <li key={item.id}><strong>{item.label}</strong>：{stored.note}（最新観測日：{stored.latestDate || "未取得"}）</li>;
              })}
            </ul>
            <details className="mt-5 border-t border-slate-100 pt-4 text-sm">
              <summary className="cursor-pointer font-medium text-sky-700">数値・出典を確認する</summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs tabular-nums">
                  <caption className="sr-only">{group.title}の半年ごとの数値。—は欠測。</caption>
                  <thead><tr><th scope="col" className="p-2 text-left">半期末</th>{series.map((item) => <th scope="col" key={item.id} className="min-w-28 p-2">{item.label}（{item.unit}）</th>)}</tr></thead>
                  <tbody>{data.map((row) => <tr key={row.period} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap p-2 text-left font-normal">{row.period}</th>{series.map((item) => <td className="p-2" key={item.id}>{row[item.id] == null ? "—" : Number(row[item.id]).toLocaleString("ja-JP", { maximumFractionDigits: 4 })}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <ul className="mt-4 space-y-2">{report.sources.filter((source) => report.series.some((s) => series.some((item) => item.id === s.id) && s.sourceIds.includes(source.id))).map((source) => <li key={source.id}><a className="text-sky-700 underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></li>)}</ul>
            </details>
          </section>
        );
      })}
      {report.fiscal && <FiscalChart fiscal={report.fiscal} periods={report.periods} asOf={report.asOf} years={years} />}
      {report.household && <HouseholdChart data={report.household} years={years} />}
    </section>
  );
}
