"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HouseholdData } from "@/lib/reports/schema";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import { chartScale } from "@/lib/reports/chart-scale";
import FixedAxisChart, { plotMargin, xAxisHeight } from "./fixed-axis-chart";

const number = (value: number | null) => value === null ? "—" : value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function HouseholdChart({ data, years }: { data: HouseholdData; years: number }) {
  const last = data.observations.at(-1)!.year;
  const rows = data.observations.filter(row => row.year >= Math.max(1995, last - years + 1));
  const percent = chartScale(rows.flatMap(r => [r.unemploymentRate, r.belowMeanShare]));
  const income = chartScale(rows.map(r => r.averageIncome));
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 05</p>
    <h3 className="mt-2 text-xl font-semibold">富の偏りと失業率</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">折れ線・左軸：完全失業率、平均所得以下の世帯割合（%） ／ 棒グラフ・右軸：全世帯の1世帯当たり平均所得金額（万円）。1995年以降の年次推移。</p>
    <FixedAxisChart left={percent} right={income} leftUnit="%" rightUnit="万円" leftTickSuffix="%" rightTickSuffix="" minWidth={Math.max(600, rows.length * 36 + 110)} height={384} label="富の偏りと失業率。左軸は割合、右軸は平均所得金額。">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={plotMargin} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="year" interval={0} angle={-55} textAnchor="end" height={xAxisHeight} tickMargin={8} tick={{ fontSize: 11 }} tickFormatter={value => `${value}年`} />
          <YAxis yAxisId="percent" hide domain={percent.domain} ticks={percent.ticks} />
          <YAxis yAxisId="income" hide domain={income.domain} ticks={income.ticks} />
          <Tooltip itemSorter={tooltipOrder(["unemploymentRate", "belowMeanShare", "averageIncome"])} labelFormatter={value => `${value}年（所得は翌年調査）`} formatter={(value, name) => [`${number(Number(value))} ${name === "平均所得金額" ? "万円" : "%"}`, name]} />
          <Bar yAxisId="income" dataKey="averageIncome" name="平均所得金額" fill="#cbd5e1" maxBarSize={22} isAnimationActive={false} />
          <Line yAxisId="percent" dataKey="unemploymentRate" name="完全失業率" stroke="#0284c7" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
          <Line yAxisId="percent" dataKey="belowMeanShare" name="平均所得以下の世帯割合" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-3 flex flex-wrap justify-center gap-4 text-xs" aria-label="凡例">
      <li className="text-sky-600">━ 完全失業率</li><li className="text-violet-600">━ 平均所得以下の世帯割合</li><li className="text-slate-500"><span style={{ color: "#cbd5e1" }}>■</span> 平均所得金額</li>
    </ul>
    <div className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
      <p>収集基準日：{data.asOf}</p>
      <p>横軸は暦年。完全失業率は全国・男女計の年平均、所得は翌年の国民生活基礎調査で把握した前年1年間の名目所得です。個人の給与や可処分所得ではありません。所得の分布を見る図であり、資産格差や貧困率を直接示すものではありません。</p>
      <p>平均所得以下の世帯割合は厚生労働省の公表値を使用。2007年所得以前の本文では「平均額より低い世帯」と表記されています。2010年所得は岩手・宮城・福島、2011年所得は福島、2015年所得は熊本を除く集計です。完全失業率の2011年値は公表資料の補完推計値を使用しています。</p>
    </div>
    <details className="mt-5 border-t border-slate-100 pt-4 text-sm">
      <summary className="cursor-pointer font-medium text-sky-700">数値・出典を確認する</summary>
      <div className="mt-4 overflow-x-auto"><table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
        <caption className="mb-2 text-left">年次統計。—は未公表・未調査。2019年所得は翌2020年調査の中止により空欄。</caption>
        <thead><tr>{["対象年", "完全失業率（%）", "平均所得金額（万円）", "平均所得以下の世帯割合（%）", "所得の調査年"].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.year} className="border-t border-slate-100"><th scope="row" className="p-2 font-normal">{row.year}年</th><td className="p-2">{number(row.unemploymentRate)}</td><td className="p-2">{number(row.averageIncome)}</td><td className="p-2">{number(row.belowMeanShare)}</td><td className="p-2">{row.surveyYear ?? "—"}</td></tr>)}</tbody>
      </table></div>
      <ul className="mt-4 space-y-2">{data.sources.map(source => <li key={source.id}><a className="text-sky-700 underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></li>)}</ul>
    </details>
  </section>;
}
