"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fdiStockData } from "@/lib/reports/fdi-stock";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import { chartScale } from "@/lib/reports/chart-scale";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#73c9b3", "#b6a0df", "#edc278", "#eca9ad", "#82a6b1", "#b7c98a", "#d8ad88", "#cbd5e1"];
const amount = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 3 });

export default function FdiChart() {
  const { points, categories, firstYear, latestYear } = fdiStockData;
  const rows = points.map(point => ({ year: point.year, ...Object.fromEntries(point.values.map((value, i) => [`value${i}`, value / 1_000_000])) }));
  const legendItems = categories.map((name, i) => ({ name, i })).reverse();
  const scale = chartScale(points.map(point => point.total / 1_000_000));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="fdi-stock-title">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 05</p>
    <h2 id="fdi-stock-title" className="mt-2 text-xl font-semibold sm:text-2xl">日本の対外直接投資残高</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{firstYear}～{latestYear}年末の年次推移。{latestYear}年末のJETRO掲載国・地域の上位8か国を全期間で固定し、残る投資先を「その他」にまとめた積み上げ棒グラフです。</p>
    <FixedAxisChart left={scale} leftUnit="残高（兆米ドル）" minWidth={Math.max(900, rows.length * 44 + 80)} height={360} label="日本の対外直接投資残高の年次積み上げ棒グラフ">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={plotMargin} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={year => `${year}年末`} />
          <YAxis hide width={0} domain={scale.domain} ticks={scale.ticks} />
          <Tooltip itemSorter={tooltipOrder(legendItems.map(({ i }) => `value${i}`))} labelFormatter={year => `${year}年末`} formatter={(value, name) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 6 })} 兆米ドル`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {categories.map((name, i) => <Bar key={name} dataKey={`value${i}`} name={name} stackId="fdi" fill={colors[i]} isAnimationActive={false} />)}
          <ReferenceLine x={2014} stroke="#64748b" strokeDasharray="4 4" label={{ value: "基準変更", position: "insideTopLeft", fontSize: 11, fill: "#475569" }} />
        </BarChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legendItems.map(({ name, i }) => <li key={name} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3" style={{ background: colors[i] }} />{name}</li>)}</ul>
    <p className="mt-5 text-sm text-slate-600">{latestYear}年末の合計：<strong>{amount(points.at(-1)!.total / 1_000_000)}兆米ドル</strong></p>
    <p className="mt-3 text-xs leading-6 text-slate-500">各年末時点の対外直接投資の資産残高で、年間の投資額（フロー）ではありません。円建て公表値を日銀の期末為替レートで米ドル換算したJETROデータを使用しています。残高の増減には投資取引以外に為替・価格変動なども影響します。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">国際収支統計の基準変更により、2013年以前と2014年以降のデータに連続性はありません。地域合計（EU・アジアなど）を順位に含めず、「その他」は世界合計から上位8か国の合計を差し引いて算出しています。</p>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の金額・出典を見る（100万米ドル）</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="対外直接投資残高の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">日本の対外直接投資残高、単位：100万米ドル</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年末</th>{categories.map(name => <th key={name} scope="col" className="p-3">{name}</th>)}<th scope="col" className="p-3">合計</th></tr></thead>
          <tbody>{points.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年末</th>{point.values.map((value, i) => <td key={i} className="p-3">{amount(value)}</td>)}<td className="p-3">{amount(point.total)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-4 text-xs leading-6">出所：<a className="text-sky-700 underline" href={fdiStockData.sourcePage} target="_blank" rel="noopener noreferrer">JETRO・直接投資統計</a>（<a className="text-sky-700 underline" href={fdiStockData.sourceUrl} target="_blank" rel="noopener noreferrer">対外直接投資残高Excel</a>）。財務省・日本銀行「本邦対外資産負債残高統計」等よりJETRO作成。</p>
      <p className="mt-2 text-xs">取得日：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(fdiStockData.retrievedAt))}</p>
    </details>
  </section>;
}
