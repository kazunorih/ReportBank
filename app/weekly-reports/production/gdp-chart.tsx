"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import gdp from "@/lib/reports/data/gdp.json";
import totals from "@/lib/reports/data/gdp-totals.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#b6a0df", "#73c9b3", "#edc278", "#e6a3b5", "#8aabd1", "#b5c989", "#d5ac83", "#74b7bd", "#c69ac3"];
const series = [...gdp.series.map((item, index) => ({ ...item, color: colors[index] })), { key: "other", name: "その他", color: "#cbd5e1" }];
const realSeries = { key: "real", name: "実質GDP（2020年連鎖価格）", color: "#be4565" };
const totalSeries = { key: "nominalOnly", name: "名目GDP（総額のみ）", color: "#64748b" };
const legend = [realSeries, totalSeries, ...series.toReversed()];
const format = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 4 });

export default function GdpChart() {
  const data: Record<string, number | null>[] = gdp.points.map(point => {
    const real = totals.points.find(total => total.year === point.year)?.real;
    const row: Record<string, number | null> = { year: point.year, total: point.total / 1_000, nominalOnly: null,
      real: real == null ? null : real / 1_000 };
    for (const item of series) row[item.key] = (point as Record<string, number>)[item.key] / 1_000;
    return row;
  });
  for (const point of totals.points.filter(point => point.year > gdp.latestYear)) {
    const row: Record<string, number | null> = { year: point.year, total: point.nominal / 1_000, nominalOnly: point.nominal / 1_000, real: point.real / 1_000 };
    for (const item of series) row[item.key] = null;
    data.push(row);
  }
  // Leave room above the tallest stack for its total label.
  const left = chartScale(data.flatMap(point => [Number(point.total) * 1.08, point.real]));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="nominal-gdp">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 04</p>
    <h2 id="nominal-gdp" className="mt-2 text-xl font-semibold sm:text-2xl">日本GDP推移</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{gdp.firstYear}～{totals.latestYear}年の名目GDPを棒、実質GDPを折れ線で表示。{gdp.latestYear}年までは{gdp.rankingYear}年のGDP構成比が大きい10産業（「その他のサービス」を除く）と「その他」の積み上げ、2025年は内訳を示さず総額のみの棒で表示しています。棒の上の数値は各年の名目GDP総額（兆円、小数第1位まで）です。横にスクロールして全期間を確認できます。</p>
    <FixedAxisChart left={left} leftUnit="GDP（兆円、実質は2020年連鎖価格）" minWidth={Math.max(900, data.length * 60 + 120)} height={380} label="日本の名目・実質GDPの年次推移">
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
          <Bar dataKey={totalSeries.key} name={totalSeries.name} stackId="gdp" fill={totalSeries.color} isAnimationActive={false}>
            <LabelList dataKey="nominalOnly" position="top" offset={6} fontSize={11} fill="#475569" formatter={value => Number(value).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
          </Bar>
          <Line dataKey={realSeries.key} name={realSeries.name} stroke={realSeries.color} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className={item.key === "real" ? "h-0.5 w-4 shrink-0" : "h-3 w-3 shrink-0"} style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">FIGURE02と同じ内閣府「2024年度国民経済計算」の経済活動別国内総生産（名目、2020年基準・2008SNA）を使用しています。各年1～12月の名目付加価値額で、生産額や売上高とは異なります。FIGURE01の農業総産出額は加算していません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">「その他」の産業：{gdp.otherIndustries.join("、")}。棒全体を公表GDP総額に一致させるため、「その他」には輸入品に課される税・関税、総資本形成に係る消費税の控除、統計上の不突合と丸め差も含みます。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">2025年の名目総額と全期間の実質総額は、内閣府「{totals.releaseName}」（{totals.releaseDate}公表）の支出側・暦年実額です。年度値や四半期の年率換算値ではありません。実質GDPは価格変動の影響を除いた2020年連鎖価格。名目の産業別内訳は2024年度年次推計を維持しており、速報の改訂時点と異なります。</p>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="産業別名目GDPの数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">日本の名目・実質GDP、単位：兆円（実質は2020年連鎖価格）</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年</th>{legend.map(item => <th scope="col" key={item.key} className="p-3">{item.name}（兆円）</th>)}<th scope="col" className="p-3">GDP総額（兆円）</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.year}年</th>{legend.map(item => <td key={item.key} className="p-3">{point[item.key] == null ? (item.key === "nominalOnly" ? "—" : "内訳未収録") : format(Number(point[item.key]))}</td>)}<td className="p-3">{format(Number(point.total))}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
