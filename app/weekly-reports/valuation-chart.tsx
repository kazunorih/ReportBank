"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import snapshot from "@/lib/reports/data/equity-valuations.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "./fixed-axis-chart";

const colors = ["#0284c7", "#0f766e", "#7c3aed", "#b45309", "#0284c7", "#0f766e", "#7c3aed"];
const monthLabel = (value: string) => `${value.slice(0, 4)}年${Number(value.slice(5, 7))}月`;

export default function ValuationChart({ years, topix }: { years: number; topix: { period: string; value: number }[] }) {
  const [era, setEra] = useState("current");
  const markets = snapshot.markets.map((market, i) => ({ ...market, color: colors[i] })).filter(market => era === "current" ? ["prime", "standard", "growth"].includes(market.id) : !["prime", "standard", "growth"].includes(market.id));
  const lastMonth = snapshot.observations.at(-1)!.month;
  const firstYear = Number(lastMonth.slice(0, 4)) - years + 1;
  const months = [...new Set(snapshot.observations.filter(row => markets.some(market => market.id === row.market)).map(row => row.month))].filter(month => Number(month.slice(0, 4)) >= firstYear);
  const observations = new Map(snapshot.observations.map(row => [`${row.month}:${row.market}`, row]));
  const panels = [
    { id: "topix", title: "TOPIX", unit: "ポイント", data: topix.slice(-years).map(row => ({ period: row.period.slice(0, 7), topix: row.value })), series: [{ id: "topix", label: "TOPIX", color: "#94a3b8" }] },
    ...(["per", "pbr"] as const).map(metric => ({
      id: metric, title: metric.toUpperCase(), unit: "倍",
      data: months.map(month => ({ period: month, ...Object.fromEntries(markets.map(market => [market.id, observations.get(`${month}:${market.id}`)?.[metric] ?? null])) })),
      series: markets,
    })),
  ];
  return <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="equity-valuation-title">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 01</p>
    <h3 id="equity-valuation-title" className="mt-2 text-xl font-semibold">株価評価指標</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">TOPIXの年末終値と、市場別PER・PBRの月末値を表示します。PER・PBRはJPX公表の連結・単純平均（総合）、単位は倍です。</p>
    <label className="mt-4 block text-sm text-slate-600">PER・PBRの市場区分<select className="ml-3 max-w-full rounded-lg border border-slate-300 bg-white p-2" value={era} onChange={event => setEra(event.target.value)}><option value="current">現行市場（2022年4月〜）</option><option value="legacy">旧市場（〜2022年3月）</option></select></label>
    <div className="mt-6 space-y-8">{panels.map(panel => {
      const data: ({ period: string } & Record<string, string | number | null>)[] = panel.data;
      const series = panel.series.filter(series => data.some(row => row[series.id] != null));
      const scale = chartScale(data.flatMap(row => series.map(s => typeof row[s.id] === "number" ? row[s.id] as number : null)));
      return <div key={panel.id} role="group" aria-label={panel.title}>
        <h4 className="font-semibold text-slate-700">{panel.title}</h4>
        <FixedAxisChart left={scale} leftUnit={`${panel.title}（${panel.unit}）`} minWidth={Math.max(650, data.length * (panel.id === "topix" ? 36 : 20))} height={280} label={`${panel.title}の推移`}>
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={plotMargin} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="period" height={xAxisHeight} angle={-45} textAnchor="end" interval="preserveStartEnd" minTickGap={35} tick={{ fontSize: 11 }} tickFormatter={monthLabel} />
            <YAxis hide domain={scale.domain} ticks={scale.ticks} />
            <Tooltip isAnimationActive={false} reverseDirection={{ x: true, y: false }} itemSorter={tooltipOrder(series.map(s => s.id))} labelFormatter={value => monthLabel(String(value))} formatter={(value, name) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 2 })} ${panel.unit}`, name]} wrapperStyle={{ width: 200 }} contentStyle={{ fontSize: 12, borderRadius: 12 }} />
            {series.map(s => panel.id === "topix" ? <Bar key={s.id} dataKey={s.id} name={s.label} fill={s.color} maxBarSize={20} isAnimationActive={false} /> : <Line key={s.id} dataKey={s.id} name={s.label} stroke={s.color} dot={false} connectNulls={false} strokeWidth={2} isAnimationActive={false} />)}
          </ComposedChart></ResponsiveContainer>
        </FixedAxisChart>
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs" aria-label={`${panel.title}の凡例`}>{series.map(s => <li key={s.id} style={{ color: s.color }}>{panel.id === "topix" ? "■" : "━"} {s.label}</li>)}</ul>
      </div>;
    })}</div>
    <p className="mt-6 text-xs leading-6 text-slate-500">PER・PBR：{monthLabel(snapshot.observations[0].month)}～{monthLabel(lastMonth)}。2022年4月の市場再編前後は別系列で、線を接続しません。公表されていない値や「－」「＊」は欠測として扱い、補間しません。連結決算を作成しない会社は単体の数値を使用します。予想利益ベースの指標ではありません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">TOPIXは既存の年末終値を使用し、6月の値や未収録年は補間しません。</p>
    <details className="mt-5 border-t border-slate-100 pt-4 text-sm"><summary className="cursor-pointer font-medium text-sky-700">数値・出典を確認する</summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">出典：<a className="text-sky-700 underline" href={snapshot.sourcePage} target="_blank" rel="noopener noreferrer">JPX「規模別・業種別PER・PBR」</a>の<a className="text-sky-700 underline" href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">長期データ（総合）</a>。取得：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(snapshot.retrievedAt))}。</p>
      {panels.map(panel => <div key={panel.id} className="mt-4 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={`${panel.title}の数値表`}><table className="w-full whitespace-nowrap text-right text-xs tabular-nums"><caption className="text-left font-semibold">{panel.title}（{panel.unit}）</caption><thead><tr><th scope="col" className="p-2 text-left">年月末</th>{panel.series.map(s => <th scope="col" className="p-2" key={s.id}>{s.label}</th>)}</tr></thead><tbody>{(panel.data as ({ period: string } & Record<string, string | number | null>)[]).map(row => <tr key={row.period} className="border-t border-slate-100"><th scope="row" className="p-2 text-left font-normal">{monthLabel(row.period)}</th>{panel.series.map(s => <td key={s.id} className="p-2">{row[s.id] == null ? "—" : Number(row[s.id]).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}</td>)}</tr>)}</tbody></table></div>)}
    </details>
  </section>;
}
