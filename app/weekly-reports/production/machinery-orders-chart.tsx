"use client";

import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import orders from "@/lib/reports/data/machinery-orders.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const series = [
  { key: "domestic", name: "内需", color: "#7bb9e5" },
  { key: "exports", name: "輸出（外需）", color: "#73c9b3" },
];
const legend = series.toReversed();
const monthLabel = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
const format = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });

export default function MachineryOrdersChart() {
  const data = orders.points.map(point => ({ ...point, domestic: point.domestic / 100, exports: point.exports / 100, total: point.total / 100 }));
  const left = chartScale(data.map(point => point.total));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="machinery-orders">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 03</p>
    <h2 id="machinery-orders" className="mt-2 text-xl font-semibold sm:text-2xl">産業機械の受注</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{monthLabel(orders.firstMonth)}～{monthLabel(orders.latestMonth)}の月次受注額を、内需と輸出（外需）の積み上げ棒グラフで表示しています（{data.length}か月）。横にスクロールして全期間を確認できます。</p>
    <FixedAxisChart left={left} leftUnit="受注額（億円）" minWidth={Math.max(900, data.length * 44 + 120)} height={380} label="産業機械の内需・輸出別月次受注額">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={plotMargin} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" height={xAxisHeight} interval={0} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={month => `${month.slice(0, 4)}/${month.slice(5)}`} />
          <YAxis hide width={0} domain={left.domain} ticks={left.ticks} />
          <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={month => monthLabel(String(month))}
            formatter={(value, name) => [`${format(Number(value))} 億円`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="orders" fill={item.color} isAnimationActive={false} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3" style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">日本産業機械工業会「産業機械受注状況」表1の「内需計」「外需」を使用。輸出は受注先が海外の「外需」を指し、同会の別統計である「産業機械輸出契約」や通関輸出実績とは異なります。内需は民需・官公需・代理店向けの合計です。季節調整前の月額であり、生産額ではありません。掲載中の最古の2021年4月資料に含まれる2019年4月まで遡り、各月は取得した資料のうち最新掲載値を採用しています。</p>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">月別の数値・出典を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="産業機械の受注額の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">産業機械の月次受注額、単位：億円</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年月</th>{legend.map(item => <th scope="col" key={item.key} className="p-3">{item.name}（億円）</th>)}<th scope="col" className="p-3">合計（億円）</th><th scope="col" className="p-3">出典（PDF）</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.month} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{monthLabel(point.month)}</th><td className="p-3">{format(point.exports)}</td><td className="p-3">{format(point.domestic)}</td><td className="p-3">{format(point.total)}</td><td className="p-3"><a href={orders.sources.find(source => source.month === point.sourceMonth)?.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{monthLabel(point.sourceMonth)}資料</a></td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
