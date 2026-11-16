"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import construction from "@/lib/reports/data/construction-work.json";
import { barLabelScale, barTotalLabel } from "@/lib/reports/bar-totals";
import { chartScale } from "@/lib/reports/chart-scale";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const format = (value: number, digits = 4) => value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
const right = { domain: [0, 100] as [number, number], ticks: [0, 20, 40, 60, 80, 100] };
const data = construction.points.map(point => ({ ...point, newConstruction: point.newConstruction / 10_000,
  maintenance: point.maintenance / 10_000, total: point.total / 10_000, workers: point.workers / 10,
  completedPerWorker: point.completed / point.workers * 10,
  // A new estimation method starts in FY2020; do not connect across the break.
  workersBefore: point.year < 2020 ? point.workers / 10 : null,
  workersAfter: point.year >= 2020 ? point.workers / 10 : null,
  ratioBefore: point.year < 2020 ? point.maintenanceRatio : null,
  ratioAfter: point.year >= 2020 ? point.maintenanceRatio : null }));
const first = data[0].year;
const last = data[data.length - 1].year;

function SourceNote() {
  return <p className="mt-5 text-xs leading-6 text-slate-500">出典：国土交通省「建設工事施工統計調査」各年度の調査結果の概要（建設業者全体：専業＋兼業）。2020年度から未回答業者の欠測値を補完する推計方法が導入されているため、2019年度以前との単純比較には注意が必要です。折れ線はこの境界で接続していません。各年度PDFの公表値を掲載しています。<a href="https://www.mlit.go.jp/statistics/details/t-other-2_tk_000194.html" target="_blank" rel="noopener noreferrer" className="ml-1 text-sky-700 underline">集計・推計方法</a></p>;
}

function Values({ employment = false }: { employment?: boolean }) {
  return <details className="mt-4 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年度別の数値・出典を見る</summary>
    <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={employment ? "建設業就業者数の数値表" : "建設工事金額と維持比率の数値表"}>
      <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
        <caption className="sr-only">{employment ? "建設業就業者数（万人）と一人あたり完成工事高（万円／人）" : "元請完成工事高（兆円）と維持比率（%）"}</caption>
        <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年度</th>{employment ? <><th scope="col" className="p-3">就業者数（万人）</th><th scope="col" className="p-3">完成工事高（億円）</th><th scope="col" className="p-3">一人あたり完成工事高（万円／人）</th></> : <><th scope="col" className="p-3">新設工事（兆円）</th><th scope="col" className="p-3">維持・修繕工事（兆円）</th><th scope="col" className="p-3">合計（兆円）</th><th scope="col" className="p-3">維持比率（%）</th></>}<th scope="col" className="p-3">出典</th></tr></thead>
        <tbody>{data.map(point => { const source = construction.sources.find(source => source.year === point.year)!; return <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年度</th>{employment ? <><td className="p-3">{format(point.workers, 1)}</td><td className="p-3">{format(point.completed, 0)}</td><td className="p-3">{format(point.completedPerWorker, 1)}</td></> : <><td className="p-3">{format(point.newConstruction)}</td><td className="p-3">{format(point.maintenance)}</td><td className="p-3">{format(point.total)}</td><td className="p-3">{format(point.maintenanceRatio, 2)}</td></>}<td className="p-3"><a href={`${source.url}#page=${employment ? source.employmentPage : source.workPage}`} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{point.year}年度PDF・{employment ? source.employmentPage : source.workPage}ページ</a>{employment && <a href={`${source.url}#page=${source.completedPage}`} target="_blank" rel="noopener noreferrer" className="ml-3 text-sky-700 underline">完成工事高・{source.completedPage}ページ</a>}</td></tr>; })}</tbody>
      </table>
    </div>
  </details>;
}

function Figure({ employment = false }: { employment?: boolean }) {
  const left = barLabelScale(data.map(point => employment ? point.completedPerWorker : point.total));
  const rightScale = employment ? chartScale(data.map(point => point.workers)) : right;
  const id = employment ? "construction-employment" : "construction-work";
  const title = employment ? "建設業の就業者数と一人あたり完成工事高" : "建設工事の新設・維持修繕";
  const legend = employment ? [{ name: "就業者数（右軸）", color: "#0284c7", line: true }, { name: "一人あたり完成工事高（左軸）", color: "#b6a0df", line: false }] : [
    { name: "維持比率（右軸）", color: "#be4565", line: true },
    { name: "維持・修繕工事", color: "#73c9b3", line: false },
    { name: "新設工事", color: "#7bb9e5", line: false },
  ];
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby={id}>
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE {employment ? "03-5" : "03-4"}</p>
    <h2 id={id} className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{first}～{last}年度の{employment ? "建設業者全体の一人あたり完成工事高を左軸の棒グラフ、就業者数を右軸の折れ線で表示。一人あたり完成工事高は完成工事高合計（元請＋下請）÷就業者数で計算しています。労働力調査の暦年平均とは対象・定義が異なり、建設工事施工統計調査の年度別公表値です。" : "元請完成工事高を、新設工事と維持・修繕工事の積み上げ棒グラフで表示。維持比率（維持・修繕工事高 ÷ 元請完成工事高合計 × 100）を右軸の折れ線で重ねています。"}</p>
    <FixedAxisChart left={left} right={rightScale} leftUnit={employment ? "一人あたり完成工事高（万円／人）" : "元請完成工事高（兆円）"} rightUnit={employment ? "就業者数（万人）" : "維持比率（%）"} rightTickSuffix={employment ? "" : "%"} minWidth={Math.max(900, data.length * 76 + 120)} height={380} label={`${title}の年度別推移`}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={plotMargin} accessibilityLayer>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={year => `${year}年度`} />
        <YAxis yAxisId="amount" hide width={0} domain={left.domain} ticks={left.ticks} />
        <YAxis yAxisId="rate" orientation="right" hide width={0} domain={rightScale.domain} ticks={rightScale.ticks} />
        <Tooltip labelFormatter={year => `${year}年度`} itemSorter={item => item.name === "維持比率" ? 0 : item.name === "維持・修繕工事" ? 1 : 2} formatter={(value, name) => [`${format(Number(value), name === "維持比率" ? 2 : employment ? 1 : 4)} ${employment ? name === "就業者数" ? "万人" : "万円／人" : name === "維持比率" ? "%" : "兆円"}`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        {employment ? <><Bar yAxisId="amount" dataKey="completedPerWorker" name="一人あたり完成工事高" fill="#b6a0df" isAnimationActive={false}><LabelList dataKey="completedPerWorker" {...barTotalLabel} /></Bar>{["workersBefore", "workersAfter"].map(key => <Line key={key} yAxisId="rate" dataKey={key} name="就業者数" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />)}</> : <>
          <Bar yAxisId="amount" dataKey="newConstruction" name="新設工事" stackId="work" fill="#7bb9e5" isAnimationActive={false} />
          <Bar yAxisId="amount" dataKey="maintenance" name="維持・修繕工事" stackId="work" fill="#73c9b3" isAnimationActive={false}><LabelList dataKey="total" {...barTotalLabel} /></Bar>
          {["ratioBefore", "ratioAfter"].map(key => <Line key={key} yAxisId="rate" dataKey={key} name="維持比率" stroke="#be4565" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />)}
        </>}
      </ComposedChart></ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.name} className="flex items-center gap-2"><span aria-hidden="true" className={item.line ? "h-0.5 w-4" : "h-3 w-3"} style={{ background: item.color }} />{item.name}</li>)}</ul>
    {!employment && <p className="mt-4 text-xs leading-6 text-slate-500">金額は名目値。棒の上は元請完成工事高合計（兆円・小数第1位）。原資料の億円単位の丸めにより、新設と維持・修繕の和が公表合計と1億円異なる年度があります。</p>}
    {employment && <p className="mt-4 text-xs leading-6 text-slate-500">一人あたり完成工事高は名目金額で、棒の上は万円／人・小数第1位。完成工事高合計は元請・下請間の重複を含むため、FIGURE03-4の元請完成工事高とは範囲が異なり、付加価値ベースの労働生産性ではありません。</p>}
    <SourceNote /><Values employment={employment} />
  </section>;
}

export default function ConstructionWorkCharts() {
  return <><Figure /><Figure employment /></>;
}
