"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import snapshot from "@/lib/reports/data/equity-valuations.json";
import { chartScale } from "@/lib/reports/chart-scale";
import { tooltipOrder } from "@/lib/reports/tooltip-order";
import FixedAxisChart, { plotMargin, xAxisHeight } from "./fixed-axis-chart";

const monthLabel = (value: string) => `${value.slice(0, 4)}年${Number(value.slice(5, 7))}月末`;

export default function ValuationChart({ years, topix }: { years: number; topix: { period: string; value: number }[] }) {
  const colors: Record<string, string> = { first: "#0284c7", second: "#0f766e", prime: "#7c3aed", standard: "#b45309" };
  const markets = snapshot.markets.map(market => ({ ...market, color: colors[market.id] }));
  const published = snapshot.observations.filter(row => row.per !== null || row.pbr !== null);
  const lastMonth = published.at(-1)!.month;
  const observations = new Map(snapshot.observations.map(row => [`${row.month}:${row.market}`, row]));
  const topixValues = new Map(topix.slice(-years).map(row => [row.period.slice(0, 7), row.value]));
  const sharedMonths = [...topixValues.keys()].filter(month => month.endsWith("-12")).sort();
  const months = sharedMonths.filter(month => published.some(row => row.month === month));
  const panels = [
    ...(["per", "pbr"] as const).map(metric => ({
      id: metric, title: metric === "per" ? "TOPIXとPER" : "PBR", unit: metric === "per" ? "ポイント／倍" : "倍",
      data: (metric === "per" ? sharedMonths : months).map(month => ({ period: month, ...(metric === "per" ? { topix: topixValues.get(month) ?? null } : {}), ...Object.fromEntries(markets.map(market => [market.id, observations.get(`${month}:${market.id}`)?.[metric] ?? null])) })),
      series: [...markets.map(market => ({ ...market, unit: "倍" })), ...(metric === "per" ? [{ id: "topix", label: "TOPIX", color: "#94a3b8", unit: "ポイント" }] : [])],
    })),
  ];
  return <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8" aria-labelledby="equity-valuation-title">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 01</p>
    <h3 id="equity-valuation-title" className="mt-2 text-xl font-semibold">株価評価指標</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">横軸はTOPIXに合わせた各年12月末です。上段はTOPIXの年末終値を棒グラフ・左軸（ポイント）、市場第一部・市場第二部・プライム・スタンダードのPERを折れ線・右軸（倍）で重ねています。下段は同じ4市場のPBRです。PER・PBRはJPX公表の連結・単純平均（総合）の12月末値、単位は倍です。</p>
    <div className="mt-6 space-y-8">{panels.map(panel => {
      const data: ({ period: string } & Record<string, string | number | null>)[] = panel.data;
      const series = panel.series.filter(series => data.some(row => row[series.id] != null));
      const values = (id: string) => data.map(row => typeof row[id] === "number" ? row[id] as number : null);
      const scale = chartScale(panel.id === "per" ? values("topix") : series.flatMap(s => values(s.id)));
      const perScale = chartScale(series.filter(s => s.id !== "topix").flatMap(s => values(s.id)));
      return <div key={panel.id} role="group" aria-label={panel.title}>
        <h4 className="font-semibold text-slate-700">{panel.title}</h4>
        {!data.length && <p className="mt-3 text-sm text-slate-500">選択した表示期間には、公表値がありません。</p>}
        <FixedAxisChart left={scale} right={panel.id === "per" ? perScale : undefined} leftUnit={panel.id === "per" ? "TOPIX（ポイント）" : "PBR（倍）"} rightUnit="PER（倍）" rightTickSuffix="" minWidth={Math.max(650, data.length * 36)} height={280} label={`${panel.title}の推移`}>
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={plotMargin} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="period" height={xAxisHeight} angle={-45} textAnchor="end" interval="preserveStartEnd" minTickGap={35} tick={{ fontSize: 11 }} tickFormatter={monthLabel} />
            <YAxis yAxisId="left" hide domain={scale.domain} ticks={scale.ticks} />
            {panel.id === "per" && <YAxis yAxisId="right" hide orientation="right" domain={perScale.domain} ticks={perScale.ticks} />}
            <Tooltip isAnimationActive={false} reverseDirection={{ x: true, y: false }} itemSorter={tooltipOrder(series.map(s => s.id))} labelFormatter={value => monthLabel(String(value))} formatter={(value, name) => [`${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 2 })} ${series.find(s => s.label === name)?.unit ?? "倍"}`, name]} wrapperStyle={{ width: 200 }} contentStyle={{ fontSize: 12, borderRadius: 12 }} />
            {series.filter(s => s.id === "topix").map(s => <Bar key={s.id} yAxisId="left" dataKey={s.id} name={s.label} fill={s.color} fillOpacity={0.65} maxBarSize={20} isAnimationActive={false} />)}
            {series.filter(s => s.id !== "topix").map(s => <Line key={s.id} yAxisId={panel.id === "per" ? "right" : "left"} dataKey={s.id} name={s.label} stroke={s.color} dot={false} connectNulls={false} strokeWidth={2} isAnimationActive={false} />)}
          </ComposedChart></ResponsiveContainer>
        </FixedAxisChart>
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs" aria-label={`${panel.title}の凡例`}>{series.map(s => <li key={s.id} style={{ color: s.color }}>{s.id === "topix" ? "■" : "━"} {s.label}</li>)}</ul>
      </div>;
    })}</div>
    <p className="mt-6 text-xs leading-6 text-slate-500">PER・PBRの原資料収録期間：{monthLabel(published[0].month)}～{monthLabel(lastMonth)}。市場第一部・市場第二部は2022年3月まで、プライム・スタンダードは2022年4月以降の別系列です。市場再編前後の線は接続しません。ご指定により、原資料の「-」「－」は0として表示しています。これは実際の評価倍率が0であることを意味しません。空欄や「＊」は欠測として扱い、補間しません。連結決算を作成しない会社は単体の数値を使用します。予想利益ベースの指標ではありません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">TOPIXは既存の年末終値を使用し、6月の値や未収録年は補間しません。</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">PER・PBRは月末公表値のうち12月を採用し、年間平均には変換していません。図と数値表はTOPIXの収録年までに揃え、12月末値が未収録の年は表示しません。</p>
    <details className="mt-5 border-t border-slate-100 pt-4 text-sm"><summary className="cursor-pointer font-medium text-sky-700">数値・出典を確認する</summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">出典：<a className="text-sky-700 underline" href={snapshot.sourcePage} target="_blank" rel="noopener noreferrer">JPX「規模別・業種別PER・PBR」</a>の<a className="text-sky-700 underline" href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">長期データ（総合）</a>。シート「{snapshot.sourceSheet}」の「市場第一部」（PER：I列、PBR：J列）・「市場第二部」（PER：N列、PBR：O列）、シート「{snapshot.currentSourceSheet}」の「プライム」（PER：D列、PBR：E列）・「スタンダード」（PER：I列、PBR：J列）を使用。取得：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(snapshot.retrievedAt))}。</p>
      {panels.map(panel => <div key={panel.id} className="mt-4 max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={`${panel.title}の数値表`}><table className="w-full whitespace-nowrap text-right text-xs tabular-nums"><caption className="text-left font-semibold">{panel.title}（{panel.unit}）</caption><thead><tr><th scope="col" className="p-2 text-left">年月末</th>{panel.series.map(s => <th scope="col" className="p-2" key={s.id}>{s.label}</th>)}</tr></thead><tbody>{(panel.data as ({ period: string } & Record<string, string | number | null>)[]).map(row => <tr key={row.period} className="border-t border-slate-100"><th scope="row" className="p-2 text-left font-normal">{monthLabel(row.period)}</th>{panel.series.map(s => <td key={s.id} className="p-2">{row[s.id] == null ? "—" : Number(row[s.id]).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}</td>)}</tr>)}</tbody></table></div>)}
    </details>
  </section>;
}
