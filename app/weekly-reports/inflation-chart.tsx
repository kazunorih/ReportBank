"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { annualInflationRows, coreInflationData, inflationSeries } from "@/lib/reports/core-inflation";
import { chartScale } from "@/lib/reports/chart-scale";
import FixedAxisChart, { plotMargin, xAxisHeight } from "./fixed-axis-chart";

const format = (value: number | null) => value === null ? "—" : value.toLocaleString("ja-JP", { maximumFractionDigits: 3 });

export default function InflationChart({ report, years }: {
  report: Parameters<typeof annualInflationRows>[0] & { sources: { id: string; name: string; url: string; retrievedAt: string }[] };
  years: number;
}) {
  const rows = annualInflationRows(report, years);
  if (!rows.length) return null;
  const firstYear = coreInflationData.observations[0].year;
  const lastYear = coreInflationData.observations.at(-1)!.year;
  const scale = chartScale(rows.flatMap(row => inflationSeries.map(series => row[series.id])));
  const rateSourceIds = report.series.filter(series => series.id === "jgb10").flatMap(series => series.sourceIds);
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="inflation-title">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 06</p>
    <h3 id="inflation-title" className="mt-2 text-xl font-semibold">金利とインフレ率（コア指標）</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">折れ線・共通軸：日銀の消費者物価コア指標の前年比年平均と、国債10年の年末金利（%）。{rows[0].year}～{rows.at(-1)!.year}年の年次推移。</p>
    <FixedAxisChart left={scale} leftUnit="金利・前年比（%）" leftTickSuffix="%" minWidth={Math.max(600, rows.length * 44 + 80)} height={384} label="金利と消費者物価のコア指標の年次推移">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={plotMargin} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="year" interval={0} angle={-55} textAnchor="end" height={xAxisHeight} tickMargin={8} tick={{ fontSize: 11 }} tickFormatter={value => `${value}年`} />
          <YAxis hide domain={scale.domain} ticks={scale.ticks} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Tooltip labelFormatter={value => `${value}年`} formatter={(value, name) => [`${format(Number(value))}%`, name]} />
          {inflationSeries.map(series => <Line key={series.id} dataKey={series.id} name={series.label} stroke={series.color} strokeWidth={2} strokeDasharray={series.id === "jgb10" ? "6 3" : undefined} dot={false} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs" aria-label="凡例">{inflationSeries.map(series => <li key={series.id} style={{ color: series.color }}><span aria-hidden="true">{series.id === "jgb10" ? "┄" : "━"}</span> {series.label}</li>)}</ul>
    <p className="mt-4 text-xs leading-6 text-slate-500">日銀Excelで最長の系列は{firstYear}年開始の加重中央値・最頻値のため、最大{lastYear - firstYear + 1}年分（{firstYear}～{lastYear}年）を掲載。刈込平均値は2001年、生鮮食品・特殊要因を除く指標は2016年から。公表開始前を補間せず、基準改定はExcelの各期間の系列を接続しています。特殊要因を除く指標は、消費税率変更・教育無償化等の影響を除いた日銀の試算値です。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">インフレ率は公表前年比の12か月平均（加重中央値・最頻値は4四半期平均）で、年平均指数の前年比とは異なります。未完了年は除外。金利はFIGURE01と同じ12月の観測値で、年平均ではありません。</p>
    <details className="mt-5 border-t border-slate-100 pt-4 text-sm">
      <summary className="cursor-pointer font-medium text-sky-700">数値・出典を確認する</summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">金利とコア指標の年次推移（%）。—は欠測。</caption>
          <thead><tr><th scope="col" className="p-2 text-left">年</th>{inflationSeries.map(series => <th scope="col" key={series.id} className="p-2">{series.label}（%）</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.year} className="border-t border-slate-100"><th scope="row" className="p-2 text-left font-normal">{row.year}年</th>{inflationSeries.map(series => <td key={series.id} className="p-2">{format(row[series.id])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <ul className="mt-4 space-y-2 text-xs text-slate-500">
        <li>出所：<a className="text-sky-700 underline" href={coreInflationData.sourceUrl} target="_blank" rel="noopener noreferrer">日本銀行・消費者物価のコア指標（Excel）</a>（取得：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(coreInflationData.retrievedAt))}）</li>
        <li><a className="text-sky-700 underline" href="https://www.boj.or.jp/research/research_data/cpi/index.htm" target="_blank" rel="noopener noreferrer">日銀・指標の定義と解説</a></li>
        {report.sources.filter(source => rateSourceIds.includes(source.id)).map(source => <li key={source.id}><a className="text-sky-700 underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></li>)}
      </ul>
    </details>
  </section>;
}
