"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import labour from "@/lib/reports/data/labour-force.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "../fixed-axis-chart";

const colors = ["#7bb9e5", "#b6a0df", "#73c9b3", "#edc278", "#e6a3b5"];
const industries = labour.categories.map((name, i) => ({ key: `industry${i}`, name, color: colors[i] }));
const bars = [...industries, { key: "other", name: "その他の就業者", color: "#cbd5e1" },
  { key: "employedOnly", name: "就業者（産業内訳未収録）", color: "#94a3b8" },
  { key: "unemployed", name: "完全失業者", color: "#f3bb79" }];
const force = { key: "labourForce", name: "労働力人口（公表総数）", color: "#be4565" };
const legend = [force, ...bars.toReversed()];
const period = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
const format = (value: number) => value.toLocaleString("ja-JP");
const data = labour.points.map(point => {
  const row: Record<string, string | number | null> = { month: point.month, other: point.other,
    unemployed: point.unemployed, employedOnly: point.employedOnly, labourForce: point.labourForce };
  industries.forEach((item, i) => { row[item.key] = point.values[i]; });
  return row;
});

export default function LabourForceChart() {
  const left = chartScale(labour.points.map(point => Math.max(point.labourForce, point.employed + point.unemployed) * 1.03));
  return <section className="min-w-0 rounded-2xl bg-white px-4 py-6 sm:p-6" aria-labelledby="monthly-labour-force">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 01-3</p>
    <h2 id="monthly-labour-force" className="mt-2 text-xl font-semibold sm:text-2xl">月次労働力人口と産業別就業者数</h2>
    <p className="mt-3 text-sm leading-7 text-slate-500">{period(labour.firstMonth)}～{period(labour.latestMonth)}の全国・男女計・15歳以上の原数値（季節調整なし）を表示。{period(labour.rankingMonth)}の主な産業別就業者数の上位5産業を全期間で固定し、残りの就業者を「その他」に集約しています。完全失業者を棒の上段に加え、労働力人口の公表総数を折れ線で重ねています。</p>
    <FixedAxisChart left={left} leftUnit="人数（万人）" minWidth={Math.max(1800, data.length * 56)} height={380} label="月次労働力人口と上位5産業別就業者数">
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={plotMargin} accessibilityLayer>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" height={xAxisHeight} interval={2} angle={-45} textAnchor="end" tick={{ fontSize: 11 }} tickFormatter={period} />
        <YAxis hide width={0} domain={left.domain} ticks={left.ticks} />
        <Tooltip itemSorter={tooltipOrder(legend.map(item => item.key))} labelFormatter={month => period(String(month))} formatter={(value, name) => [`${format(Number(value))} 万人`, name]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        {bars.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId="labour" fill={item.color} isAnimationActive={false} />)}
        <Line dataKey={force.key} name={force.name} stroke={force.color} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer>
    </FixedAxisChart>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="凡例">{legend.map(item => <li key={item.key} className="flex items-center gap-2"><span aria-hidden="true" className={item.key === force.key ? "h-0.5 w-4" : "h-3 w-3"} style={{ background: item.color }} />{item.name}</li>)}</ul>
    <p className="mt-5 text-xs leading-6 text-slate-500">労働力人口は就業者と完全失業者の合計です。非労働力人口は含みません。「その他の就業者」＝就業者総数－上位5産業合計で、選定外の産業・分類不能の産業を含みます。原資料の時系列接続用補正・丸めにより、公表労働力人口と就業者＋完全失業者に最大3万人の差があるため、公表値をそのまま保持しています。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">現行区分につながる産業別時系列は2002年1月からです。2001年は分類範囲の異なる旧産業を接続せず、就業者総数のみを別色で表示。2002～2006年の産業別値には公式の遡及推計値が含まれ、2011年3～8月は東日本大震災による補完推計値です。2013年1月には派遣社員の産業分類が派遣元から派遣先へ変更されています。人口基準改定に伴う時系列接続用数値を使用しており、当時の公表値と異なる場合があります。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">出典：総務省統計局「<a href={labour.indexUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">労働力調査結果</a>」長期時系列表1-a-1・1-c-3（原数値）。取得日：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(labour.retrievedAt))}。{labour.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="ml-3 text-sky-700 underline">表{source.table}（Excel）</a>)}</p>
    <details className="mt-4 text-sm text-slate-600"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700 focus-visible:outline-2">月別の数値を見る</summary>
      <div className="mt-2 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label="月次労働力人口と産業別就業者数の数値表">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums"><caption className="sr-only">全国・男女計・原数値、単位：万人</caption>
          <thead className="sticky top-0 bg-slate-100"><tr><th scope="col" className="p-3 text-left">年月</th>{labour.categories.map(name => <th scope="col" key={name} className="p-3">{name}</th>)}<th scope="col" className="p-3">その他の就業者</th><th scope="col" className="p-3">就業者総数</th><th scope="col" className="p-3">完全失業者</th><th scope="col" className="p-3">労働力人口</th><th scope="col" className="p-3">公表総数との差</th><th scope="col" className="p-3">注記</th></tr></thead>
          <tbody>{labour.points.map(point => <tr key={point.month} className="border-b border-slate-100"><th scope="row" className="p-3 text-left font-normal">{period(point.month)}</th>{point.values.map((value, i) => <td key={i} className="p-3">{value === null ? "内訳未収録" : format(value)}</td>)}<td className="p-3">{point.other === null ? "内訳未収録" : format(point.other)}</td><td className="p-3">{format(point.employed)}</td><td className="p-3">{format(point.unemployed)}</td><td className="p-3">{format(point.labourForce)}</td><td className="p-3">{format(point.reconciliationGap)}</td><td className="p-3">{point.supplementaryEstimate ? "補完推計値" : point.month >= "2002-01" && point.month <= "2006-12" ? "一部産業に遡及推計値" : point.employedOnly !== null ? "産業分類が異なるため内訳未収録" : "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}
