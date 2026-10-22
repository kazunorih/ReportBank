"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import { chartScale } from "@/lib/reports/chart-scale";
import { type TradeChart, tradeMonth } from "@/lib/reports/trade";
import { examplesForCommodity } from "@/lib/reports/trade-examples";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const palette = ["#7bb9e5", "#73c9b3", "#b6a0df", "#edc278", "#eca9ad", "#82a6b1", "#b7c98a", "#d8ad88"];
const amount = (value: number, divisor: number) => (value / divisor).toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

export default function TradeCharts({ charts, latestMonth, firstFigure = 1, sourceUnit = "百万円" }: { charts: TradeChart[]; latestMonth: string; firstFigure?: number; sourceUnit?: "百万円" | "千円" }) {
  const divisor = sourceUnit === "千円" ? 1_000_000_000 : 1_000_000;
  return <div className="space-y-8">{charts.map((chart, index) => {
    const colors = chart.categories.map((name, i) => name === "その他" ? "#cbd5e1" : palette[i]);
    const data = chart.points.map(point => ({ month: point.month, ...Object.fromEntries(point.values.map((value, i) => [`value${i}`, value === null ? null : value / divisor])) }));
    const scale = chartScale(chart.points.map(point => point.total / divisor));
    const legendItems = chart.categories.map((name, i) => ({ name, i })).reverse();
    const latest = chart.points[chart.points.length - 1];
    return <section key={chart.id} className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby={chart.id}>
      <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE {String(index + firstFigure).padStart(2, "0")}</p>
      <h2 id={chart.id} className="mt-2 text-xl font-semibold sm:text-2xl">{chart.title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-500">{tradeMonth(latestMonth)}の上位{chart.categories.length - 1}{chart.id.startsWith("port") ? "港（空港を含む）" : chart.id.startsWith("country") ? "か国・地域" : "品目（主要商品大分類）"}とその他。各月の金額を積み上げて表示します。</p>
      {chart.id.startsWith("port") && <p className="mt-2 text-xs leading-6 text-slate-500">2000年1月からの月次推移。最新月の上位8港を全期間で固定し、税関官署の3桁符号ごとに集計しています。実際に貨物を積卸した港の統計とは異なります。</p>}
      <FixedAxisChart left={scale} leftUnit="金額（兆円）" minWidth={Math.max(1800, chart.points.length * 30)} height={360} label={chart.title}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={plotMargin} accessibilityLayer>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" height={xAxisHeight} interval={2} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={tradeMonth} />
            <YAxis hide width={0} domain={scale.domain} ticks={scale.ticks} />
            <Tooltip itemSorter={tooltipOrder(legendItems.map(({ i }) => `value${i}`))} labelFormatter={label => tradeMonth(String(label))} formatter={(value, name) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 6 })} 兆円`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            {chart.categories.map((name, i) => <Bar key={name} dataKey={`value${i}`} name={name} stackId="trade" fill={colors[i]} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </FixedAxisChart>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legendItems.map(({ name, i }) => <li key={name} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3" style={{ background: colors[i] }} />{name}</li>)}</ul>
      {chart.id.startsWith("commodity") && <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
        <h3 className="font-semibold text-slate-700">品目に含まれる商品の例</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">{chart.categories.map((name, i) => <div key={name}>
          <dt className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: colors[i] }} />{name}</dt>
          <dd className="ml-4.5">{examplesForCommodity(name, chart.categories).join("、")}</dd>
        </div>)}</dl>
        <p className="mt-3">商品例は分類の一部です。「その他」は上位5品目以外の大分類と、公表分類「その他」の合計です。</p>
        <a className="text-sky-700 underline" href="https://www.customs.go.jp/toukei/shinbun/happyou.htm" target="_blank" rel="noopener noreferrer">出典：税関・主要商品別輸出入表</a>
      </div>}
      <p className="mt-5 text-sm text-slate-600">最新月の合計：<strong>{amount(latest.total, divisor)}兆円</strong></p>
      <details className="mt-4 text-sm text-slate-600">
        <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">月別の金額を見る（{sourceUnit}）</summary>
        <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={`${chart.title}の数値表`}>
          <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
            <caption className="sr-only">{chart.title}、単位：{sourceUnit}</caption>
            <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年月</th>{chart.categories.map(name => <th key={name} scope="col" className="p-3">{name}</th>)}<th scope="col" className="p-3">合計</th></tr></thead>
            <tbody>{chart.points.map(point => <tr key={point.month} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{tradeMonth(point.month)}</th>{point.values.map((value, i) => <td key={i} className="p-3">{value === null ? "—" : value.toLocaleString("ja-JP")}</td>)}<td className="p-3">{point.total.toLocaleString("ja-JP")}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>;
  })}</div>;
}
