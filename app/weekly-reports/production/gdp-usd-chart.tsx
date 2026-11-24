"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import gdp from "@/lib/reports/data/gdp.json";
import totals from "@/lib/reports/data/gdp-totals.json";
import exchange from "@/lib/reports/data/gdp-usd-exchange.json";
import { usdGdpData as data, usdGdpSeries } from "@/lib/reports/gdp-usd";
import { barLabelScale } from "@/lib/reports/bar-totals";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#b6a0df", "#73c9b3", "#edc278", "#e6a3b5", "#8aabd1", "#b5c989", "#d5ac83", "#74b7bd", "#c69ac3", "#cbd5e1"];
const series = usdGdpSeries.map((item, index) => ({ ...item, color: colors[index] }));
const totalSeries = { key: "nominalOnly", name: "名目GDP（総額のみ）", color: "#64748b" };
const legend = [totalSeries, ...series.toReversed()];
const format = (value: number, digits = 4) => value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
const totalLabel = { position: "top" as const, offset: 6, fontSize: 11, fill: "#475569", formatter: (value: unknown) => Number(value).toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };

export default function GdpUsdChart() {
  const left = barLabelScale(data.map(point => point.total));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="nominal-gdp-usd">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 01-2</p>
    <h2 id="nominal-gdp-usd" className="mt-2 text-xl font-semibold sm:text-2xl">日本の名目GDP推移（米ドル建て）</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{gdp.firstYear}～{totals.latestYear}年の円建て名目GDPを、各暦年の平均為替レートで米ドルに換算しています。FIGURE01と同じ{gdp.rankingYear}年基準の上位10産業と「その他」を積み上げ表示。{gdp.latestYear}年より後は産業別内訳が未収録のため総額のみの棒です。棒の上は名目GDP総額（兆米ドル、小数第2位まで）。</p>
    <FixedAxisChart left={left} leftUnit="名目GDP（兆米ドル）" minWidth={Math.max(900, data.length * 60 + 120)} height={380} label="日本の米ドル建て産業別名目GDPの年次推移">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={plotMargin} accessibilityLayer>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={year => `${year}年`} />
        <YAxis hide width={0} domain={left.domain} ticks={left.ticks} />
        <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={year => { const point = data.find(point => point.year === Number(year)); return `${year}年（年平均：1米ドル＝${format(Number(point?.yenPerUsd), 2)}円）`; }} formatter={(value, name) => [`${format(Number(value))} 兆米ドル`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="gdp-usd" fill={item.color} isAnimationActive={false}>{item.key === "other" && <LabelList dataKey="total" {...totalLabel} />}</Bar>)}
        <Bar dataKey={totalSeries.key} name={totalSeries.name} stackId="gdp-usd" fill={totalSeries.color} isAnimationActive={false}><LabelList dataKey="nominalOnly" {...totalLabel} /></Bar>
      </BarChart></ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">計算式：名目GDP（10億円）÷ 年平均為替（円／米ドル）÷ 1,000 ＝ 兆米ドル。全産業を同じ年のレートで換算するため、各年の構成比はFIGURE01と同じです。名目円建てGDPと為替の両方の変化を含み、実質成長率や購買力平価（PPP）を示すものではありません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">GDPはFIGURE01と同じ内閣府資料を使用。「その他」には産業の残余に加え税・関税等の調整を含みます。2025年の総額は「{totals.releaseName}」（{totals.releaseDate}公表）を使用し、産業別値とは改訂時点が異なります。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">為替出典：<a href={exchange.indexUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">世界銀行・Official exchange rate（PA.NUS.FCRF、日本、IMF International Financial Statistics）</a>。暦年平均（円／米ドル）であり年末レートではありません。取得日：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(exchange.retrievedAt))}。</p>
    <details className="mt-4 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値・年平均為替を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="米ドル建て産業別名目GDPと年平均為替の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums"><caption className="sr-only">米ドル建て名目GDP、単位：兆米ドル。為替：円／米ドル</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年</th><th scope="col" className="p-3">年平均為替（円／米ドル）</th>{series.toReversed().map(item => <th scope="col" key={item.key} className="p-3">{item.name}（兆米ドル）</th>)}<th scope="col" className="p-3">GDP総額（兆米ドル）</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年</th><td className="p-3">{format(Number(point.yenPerUsd), 6)}</td>{series.toReversed().map(item => <td key={item.key} className="p-3">{point[item.key] === null ? "内訳未収録" : format(Number(point[item.key]))}</td>)}<td className="p-3">{format(Number(point.total))}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
