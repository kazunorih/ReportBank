"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartScale } from "@/lib/reports/chart-scale";
import { productionData } from "@/lib/reports/production";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const agriculturalSeries = [
  { key: "rice", name: "米", color: "#7bb9e5" },
  { key: "vegetables", name: "野菜", color: "#73c9b3" },
  { key: "livestock", name: "畜産", color: "#b6a0df" },
  { key: "other", name: "その他", color: "#cbd5e1" },
];
const industrialSeries = [
  { key: "mining", name: "鉱業", color: "#edc278" },
  { key: "manufacturing", name: "製造業", color: "#7bb9e5" },
  { key: "construction", name: "建設業", color: "#73c9b3" },
];
const rateSeries = { key: "rate", name: "食料自給率（カロリーベース）", color: "#be4565" };
const format = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
type AnnualPoint = { year: number; total: number | null; [key: string]: number | boolean | null | undefined };

function AnnualFigure({ agricultural }: { agricultural: boolean }) {
  const series = agricultural ? agriculturalSeries : industrialSeries;
  const farmByYear = new Map(productionData.agriculture.map(point => [point.year, point]));
  const data: AnnualPoint[] = agricultural ? productionData.selfSufficiency.map(point => {
    const farm = farmByYear.get(point.year);
    return { year: point.year, rate: point.rate, provisional: point.provisional,
      rice: farm ? farm.rice / 10_000 : null, vegetables: farm ? farm.vegetables / 10_000 : null,
      livestock: farm ? farm.livestock / 10_000 : null, other: farm ? farm.other / 10_000 : null,
      total: farm ? farm.total / 10_000 : null };
  }) : productionData.industry.map(point => ({ year: point.year, mining: point.mining / 1_000,
    manufacturing: point.manufacturing / 1_000, construction: point.construction / 1_000, total: point.total / 1_000 }));
  const left = chartScale(data.map(point => point.total));
  const right = { domain: [0, 100] as [number, number], ticks: [0, 20, 40, 60, 80, 100] };
  // Lines precede bars; bars follow the stack from top to bottom in both legend and tooltip.
  const legend = [...(agricultural ? [rateSeries] : []), ...series.toReversed()];
  const title = agricultural ? "農業生産" : "工業生産";
  const id = agricultural ? "agricultural-production" : "industrial-production";
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby={id}>
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE {agricultural ? "01" : "02"}</p>
    <h2 id={id} className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{agricultural
      ? "1975～2024年の農業総産出額を、米・野菜・畜産・その他の積み上げ棒グラフで表示。食料自給率は1975～2025年度（2025年度は概算）を右軸の折れ線で重ねています。"
      : "1994～2024年の第2次産業（鉱業・製造業・建設業）の名目GDP実額を積み上げ表示。同一の2020年基準・2008SNAで取得できる全期間です。"}</p>
    <FixedAxisChart left={left} right={agricultural ? right : undefined} leftUnit={agricultural ? "農業総産出額（兆円）" : "名目GDP（兆円）"}
      rightUnit="食料自給率（%）" minWidth={Math.max(900, data.length * 44 + 120)} height={380} label={`${title}の年次推移`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={plotMargin} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={year => `${year}年`} />
          <YAxis yAxisId="amount" hide width={0} domain={left.domain} ticks={left.ticks} />
          {agricultural && <YAxis yAxisId="rate" orientation="right" hide width={0} domain={right.domain} ticks={right.ticks} />}
          <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={year => agricultural ? `${year}年（自給率は年度）` : `${year}年`}
            formatter={(value, name) => [`${format(Number(value))}${name === rateSeries.name ? " %" : " 兆円"}`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {series.map(item => <Bar key={item.key} yAxisId="amount" dataKey={item.key} name={item.name} stackId="production" fill={item.color} isAnimationActive={false} />)}
          {agricultural && <Line yAxisId="rate" dataKey="rate" name={rateSeries.name} stroke={rateSeries.color} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className={item.key === "rate" ? "h-0.5 w-4" : "h-3 w-3"} style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">{agricultural
      ? "農業総産出額は暦年、自給率は年度の値を同じ年の位置に表示しています。1975年の産出額は沖縄県を含みません。「その他」は総産出額から米・野菜・畜産を差し引いた額で、果実・花き・麦類・加工農産物などを含みます。2025年の産出額は未収録のため棒を表示していません。"
      : "各年1～12月の名目付加価値額です。生産量の指数や売上高ではありません。旧基準の系列を接続せず、1994年からの一貫した系列を使用しています。金額の変化には価格変動も含まれます。"}</p>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={`${title}の数値表`}>
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">{title}、金額：兆円{agricultural ? "、自給率：%（年度）" : ""}</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年</th>{legend.map(item => <th scope="col" key={item.key} className="p-3">{item.name}{item.key === "rate" ? "（%）" : "（兆円）"}</th>)}<th scope="col" className="p-3">合計（兆円）</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年{("provisional" in point && point.provisional) ? "（自給率：概算）" : ""}</th>{legend.map(item => { const value = (point as Record<string, unknown>)[item.key]; return <td key={item.key} className="p-3">{typeof value === "number" ? format(value) : "未収録"}</td>; })}<td className="p-3">{point.total === null ? "未収録" : format(point.total)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}

export default function ProductionCharts() {
  return <div className="space-y-8"><AnnualFigure agricultural /><AnnualFigure agricultural={false} /></div>;
}
