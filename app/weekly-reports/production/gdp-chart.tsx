"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import gdp from "@/lib/reports/data/gdp.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#b6a0df", "#73c9b3", "#edc278", "#e6a3b5", "#8aabd1", "#b5c989", "#d5ac83", "#74b7bd", "#c69ac3"];
const series = [...gdp.series.map((item, index) => ({ ...item, color: colors[index] })), { key: "other", name: "その他", color: "#cbd5e1" }];
const legend = series.toReversed();
const format = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 4 });

export default function GdpChart() {
  const data = gdp.points.map(point => {
    const row: Record<string, number> = { year: point.year, total: point.total / 1_000 };
    for (const item of series) row[item.key] = (point as Record<string, number>)[item.key] / 1_000;
    return row;
  });
  // Leave room above the tallest stack for its total label.
  const left = chartScale(data.map(point => point.total * 1.08));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="nominal-gdp">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 04</p>
    <h2 id="nominal-gdp" className="mt-2 text-xl font-semibold sm:text-2xl">名目GDPの産業別内訳</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{gdp.firstYear}～{gdp.latestYear}年の名目GDP全体額を年次の積み上げ棒グラフで表示。{gdp.rankingYear}年のGDP構成比が大きい上位10産業を全期間で共通に表示し、農業を含む残りの産業は「その他」にまとめています。棒の上の数値は各年のGDP総額（兆円、小数第1位まで）です。横にスクロールして全期間を確認できます。</p>
    <FixedAxisChart left={left} leftUnit="名目GDP（兆円）" minWidth={Math.max(900, data.length * 60 + 120)} height={380} label="名目GDPの産業別年次推移">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={plotMargin} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={year => `${year}年`} />
          <YAxis hide width={0} domain={left.domain} ticks={left.ticks} />
          <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={year => `${year}年`}
            formatter={(value, name) => [`${format(Number(value))} 兆円`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="gdp" fill={item.color} isAnimationActive={false}>
            {item.key === "other" && <LabelList dataKey="total" position="top" offset={6} fontSize={11} fill="#475569" formatter={value => Number(value).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />}
          </Bar>)}
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">FIGURE02と同じ内閣府「2024年度国民経済計算」の経済活動別国内総生産（名目、2020年基準・2008SNA）を使用しています。各年1～12月の名目付加価値額で、生産額や売上高とは異なります。FIGURE01の農業総産出額は加算していません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">「その他」の産業：{gdp.otherIndustries.join("、")}。棒全体を公表GDP総額に一致させるため、「その他」には輸入品に課される税・関税、総資本形成に係る消費税の控除、統計上の不突合と丸め差も含みます。</p>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="産業別名目GDPの数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">産業別名目GDP、単位：兆円</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年</th>{legend.map(item => <th scope="col" key={item.key} className="p-3">{item.name}（兆円）</th>)}<th scope="col" className="p-3">GDP総額（兆円）</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年</th>{legend.map(item => <td key={item.key} className="p-3">{format(point[item.key])}</td>)}<td className="p-3">{format(point.total)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
