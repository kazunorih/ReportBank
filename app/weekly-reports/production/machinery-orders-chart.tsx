"use client";

import { Bar, LabelList, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import orders from "@/lib/reports/data/machinery-orders.json";
import { annualOrders } from "@/lib/reports/machinery-orders";
import { barTotalLabel, barLabelScale, stackLabelValue } from "@/lib/reports/bar-totals";
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
  const data = annualOrders.map(point => ({ ...point, domestic: point.domestic / 100, exports: point.exports / 100, total: point.total / 100 }));
  const left = barLabelScale(data.map(point => point.total));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="machinery-orders">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 03-1</p>
    <h2 id="machinery-orders" className="mt-2 text-xl font-semibold sm:text-2xl">産業機械の受注</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">FIGURE03「工業生産」を読み解く参考として、2020～2025年の各暦年（1～12月）と、2026年1～8月（8か月分）の受注額を、内需と輸出（外需）の積み上げ棒グラフで表示しています。2026年は途中経過であり、通年額とは対象期間が異なります。受注額はGDPの付加価値額にそのまま加算できる内訳ではありません。</p>
    <p className="mt-3 text-sm leading-7 text-slate-500">ここでいう産業機械は、工場・発電所・プラントなどで、生産やエネルギー供給、流体の移送、荷物の運搬などに使う機械・設備です。受注額の大きい代表的な8機種は、ボイラ・原動機（蒸気の発生や動力の供給）、化学機械〈冷凍機械を含む〉（化学製品の製造・冷却）、ポンプ（液体の移送）、運搬機械（クレーン・コンベヤなど）、圧縮機（空気・ガスの圧縮）、プラスチック加工機械（樹脂の成形・加工）、タンク（液体・ガスなどの貯蔵）、金属加工機械（金属の成形・加工）です。</p>
    <p className="mt-1 text-xs leading-6 text-slate-500">例は<a href="https://www.jsim.or.jp/pdf/statistical-data/a-1-54-00-00-00-202608.pdf#page=3" target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">2026年8月資料の表2「産業機械 機種別受注状況」</a>に掲載された2025年度の受注額順。「その他機械」を除く上位8機種を挙げています。</p>
    <FixedAxisChart left={left} leftUnit="受注額（億円）" minWidth={1050} height={380} label="産業機械の内需・輸出別年次受注額">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={plotMargin} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" height={xAxisHeight} interval={0} tick={{ fontSize: 11 }} />
          <YAxis hide width={0} domain={left.domain} ticks={left.ticks} />
          <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))}
            formatter={(value, name) => [`${format(Number(value))} 億円`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="orders" fill={item.color} isAnimationActive={false}><LabelList dataKey={(row: Record<string, unknown>) => stackLabelValue(row, series.map(entry => entry.key), item.key, "total")} {...barTotalLabel} /></Bar>)}
        </ComposedChart>
      </ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3" style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">日本産業機械工業会「産業機械受注状況」表1の「内需計」「外需」を使用。内需は国内の民需・官公需・代理店向けの合計です。輸出は受注先が海外の「外需」を指し、同会の別統計である「産業機械輸出契約」や通関輸出実績とは異なります。各月は取得した資料のうち最新掲載値を採用し、季節調整前の月額を暦年で合計しています。年度の合計や生産額ではありません。</p>
    <details className="mt-4 text-sm text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">年別の数値・出典を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="産業機械の受注額の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">産業機械の受注額（2020～2025年は1～12月、2026年は1～8月）、単位：億円</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">対象期間</th>{legend.map(item => <th scope="col" key={item.key} className="p-3">{item.name}（億円）</th>)}<th scope="col" className="p-3">合計（億円）</th><th scope="col" className="p-3">出典（PDF）</th></tr></thead>
          <tbody>{data.map(point => <tr key={point.year} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{point.label}</th><td className="p-3">{format(point.exports)}</td><td className="p-3">{format(point.domestic)}</td><td className="p-3">{format(point.total)}</td><td className="p-3"><details><summary className="cursor-pointer text-sky-700">採用資料一覧</summary><ul className="mt-2 space-y-1">{point.sourceMonths.map(month => <li key={month}><a href={orders.sources.find(source => source.month === month)?.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{monthLabel(month)}資料</a></li>)}</ul></details></td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
