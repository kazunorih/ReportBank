"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import shipments from "@/lib/reports/data/construction-machinery.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#b6a0df", "#73c9b3", "#edc278", "#e6a3b5"];
const series = [...shipments.series.map((item, index) => ({ ...item, color: colors[index] })), { key: "other", name: "その他", color: "#cbd5e1" }];
const legend = series.toReversed();
const format = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const period = (year: number, months: number) => months === 12 ? `${year}年` : `${year}年1～${months}月（${months}か月分）`;

export default function ConstructionMachineryChart() {
  const data = shipments.points.map(point => {
    const row: Record<string, number> = { year: point.year, months: point.months, total: point.total / 100 };
    for (const item of series) row[item.key] = (point as unknown as Record<string, number>)[item.key] / 100;
    return row;
  });
  const latest = data[data.length - 1];
  const left = chartScale(data.map(point => point.total * 1.08));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="construction-machinery">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 03-2</p>
    <h2 id="construction-machinery" className="mt-2 text-xl font-semibold sm:text-2xl">建設機械の出荷</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">FIGURE03「工業生産」を読み解く参考として、1995年から{period(latest.year, latest.months)}までの建設機械出荷額（国内・輸出の合計）を表示しています。通年は暦年（1～12月）で集計し、最新年の途中経過は対象月数を横軸に明示しています。{shipments.rankingYear}年の通年出荷額が大きい5分類を共通表示し、残りを「その他」にまとめています。</p>
    <FixedAxisChart left={left} leftUnit="出荷額（億円）" minWidth={Math.max(900, data.length * 78 + 140)} height={380} label="建設機械の分類別暦年出荷額">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={plotMargin} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" height={xAxisHeight} interval={0} tick={({ x, y, payload }) => {
            const point = data.find(point => point.year === Number(payload.value));
            return <text x={x} y={Number(y) + 14} textAnchor="middle" fill="#64748b" fontSize={11}>
              <tspan x={x}>{payload.value}年</tspan>
              {point && point.months < 12 && <><tspan x={x} dy={14}>1～{point.months}月</tspan><tspan x={x} dy={14}>（{point.months}か月分）</tspan></>}
            </text>;
          }} />
          <YAxis hide width={0} domain={left.domain} ticks={left.ticks} />
          <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={year => { const point = data.find(point => point.year === Number(year)); return point ? period(point.year, point.months) : `${year}年`; }} formatter={(value, name) => [`${format(Number(value))} 億円`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="shipments" fill={item.color} isAnimationActive={false}>
            {item.key === "other" && <LabelList dataKey="total" position="top" offset={6} fontSize={11} fill="#475569" formatter={value => Number(value).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />}
          </Bar>)}
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">日本建設機械工業会「建設機械出荷金額統計（内需、外需）」を使用。出荷額は販売された機械や補給部品の金額で、GDPの付加価値額にそのまま加算できる内訳ではありません。油圧ショベルとミニショベルは過去の分類変更に配慮して合算。「補給部品」も含む総合計を使用し、「その他」は残りの機種（その他建設機械等）です。棒の上は各期間の合計額（億円、小数第1位まで）。最新年の途中経過は通年額とは対象期間が異なります。</p>
    <details className="mt-4 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値・出典を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="建設機械出荷額の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums"><caption className="sr-only">建設機械の分類別出荷額、単位：億円</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">対象期間</th>{legend.map(item => <th key={item.key} scope="col" className="p-3">{item.name}（億円）</th>)}<th scope="col" className="p-3">合計（億円）</th><th scope="col" className="p-3">出典</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{period(point.year, point.months)}</th>{legend.map(item => <td key={item.key} className="p-3">{format(point[item.key])}</td>)}<td className="p-3">{format(point.total)}</td><td className="p-3"><a href={shipments.sources.find(source => source.year === point.year)?.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{point.year}年資料（Excel）</a></td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
