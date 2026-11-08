"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import production from "@/lib/reports/data/product-production.json";
import { barLabelScale, barTotalLabel, stackLabelValue } from "@/lib/reports/bar-totals";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#73c9b3", "#b6a0df", "#edc278", "#eca9ad", "#82a6b1", "#b7c98a", "#d8ad88", "#a39dc7", "#7cb5a1"];
const series = [...production.series.map((item, index) => ({ ...item, color: colors[index] })), { key: "other", name: "その他", color: "#cbd5e1" }];
const legend = series.toReversed();
const amount = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 6 });

export default function ProductProductionChart() {
  const data = production.points.map(point => {
    const row: Record<string, number | null> = { year: point.year, total: point.total / 1_000_000 };
    for (const item of series) {
      const value = (point as unknown as Record<string, unknown>)[item.key];
      row[item.key] = typeof value === "number" ? value / 1_000_000 : null;
    }
    return row;
  });
  const scale = barLabelScale(data.map(point => point.total));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="product-production">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 03-3</p>
    <h2 id="product-production" className="mt-2 text-xl font-semibold sm:text-2xl">品目別生産統計</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{production.firstYear}～{production.latestYear}年の経済産業省生産動態統計年報から、暦年（1～12月）の生産金額を表示しています。年報全体のうち生産金額を数値で確認できる品目を対象に、{production.rankingYear}年の金額が大きい10品目を全期間で共通表示し、残りを「その他」にまとめています。棒の上は掲載した公表数値の合計（兆円、小数第1位まで）です。</p>
    <FixedAxisChart left={scale} leftUnit="生産金額（兆円、公表数値の合計）" minWidth={Math.max(900, data.length * 82 + 140)} height={380} label="品目別生産金額の暦年推移">
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={plotMargin} accessibilityLayer>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={year => `${year}年`} />
        <YAxis hide width={0} domain={scale.domain} ticks={scale.ticks} />
        <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={year => `${year}年（1～12月）`} formatter={(value, name) => [`${amount(Number(value))} 兆円`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="products" fill={item.color} isAnimationActive={false}><LabelList dataKey={(row: Record<string, unknown>) => stackLabelValue(row, series.map(s => s.key), item.key, "total")} {...barTotalLabel} /></Bar>)}
      </ComposedChart></ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">軽・小型・普通乗用車は「乗用車」、軽・小型・普通トラックは「トラック」、各種二輪自動車は「二輪自動車」に集約しています。けん引車・特殊自動車・トレーラ・車体や自動車部品は別品目です。化粧品は全国の生産金額だけを採用し、地域別の再掲は加算していません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">生産数量・販売金額・在庫金額での代用はしていません。秘匿（X）・不詳・未公表は0に置き換えず、数値が確認できない分は棒と合計から除いています。一部だけ公表される集約品目は公表分の金額です。生産金額を調査していない品目も含まれないため、この合計は日本の工業生産全体の総額ではありません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">親分類とその内訳、地域別・印刷方式別などの再掲の重複加算を避けています。調査対象・品目分類・調査単位の変更があるため、年ごとの金額差には対象範囲の変化も含まれます。秘匿・資料未収録・分類変更により金額を確認できない品目は数値表に「未収録」と表示します。GDPの付加価値額とは異なり、製品・部品間の取引も含む生産金額です。</p>
    <details className="mt-4 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値・出典を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="品目別生産金額の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums"><caption className="sr-only">品目別生産金額、単位：兆円</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">暦年</th>{legend.map(item => <th scope="col" key={item.key} className="p-3">{item.name}（兆円）</th>)}<th scope="col" className="p-3">公表数値の合計（兆円）</th><th scope="col" className="p-3">出典・欠測情報</th></tr></thead>
          <tbody>{data.map((point, index) => { const sourcePoint = production.points[index]; return <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年</th>{legend.map(item => <td key={item.key} className="p-3">{point[item.key] === null ? "未収録" : amount(Number(point[item.key]))}{sourcePoint.partialCategories.includes(item.name) ? "（公表分）" : ""}</td>)}<td className="p-3">{amount(Number(point.total))}</td><td className="p-3"><details><summary className="cursor-pointer text-sky-700">採用資料・欠測</summary><p className="mt-2">数値確認：{sourcePoint.observedItems}件／秘匿等：{sourcePoint.missingItems}件</p><ul className="mt-2 max-w-96 space-y-2 whitespace-normal text-left">{sourcePoint.sourceIds.map(id => { const source = production.sources.find(source => source.id === id); return <li key={id}><a href={source?.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{source?.name ?? id}</a></li>; })}</ul></details></td></tr>; })}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
