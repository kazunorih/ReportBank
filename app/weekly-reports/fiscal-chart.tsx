"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FiscalData } from "@/lib/reports/schema";

const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("ja-JP", { maximumFractionDigits: 4 });

export default function FiscalChart({ fiscal, periods, asOf, years }: { fiscal: FiscalData; periods: string[]; asOf: string; years: number }) {
  const debt = periods.slice(-years * 2).map(date => ({ date, amount: fiscal.debt.find(row => row.date === date)?.amount ?? null }));
  const currentFy = Number(asOf.slice(0, 4)) - (Number(asOf.slice(5, 7)) < 4 ? 1 : 0);
  const budgets = Array.from({ length: years }, (_, index) => {
    const fiscalYear = currentFy - years + 1 + index;
    const row = fiscal.budgets.find(row => row.fiscalYear === fiscalYear);
    return { fiscalYear, interest: row?.interest ?? null, budget: row?.budget ?? null, share: row?.share ?? null };
  });
  const width = Math.max(600, years * 36 + 110);
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
    <p className="text-xs font-semibold tracking-widest text-sky-700">FIGURE 04</p>
    <h3 className="mt-2 text-xl font-semibold">政府の債務残高と利払い負担</h3>
    <div className="mt-6 space-y-8">
      <section>
        <h4 className="font-semibold">国債及び借入金現在高</h4>
        <p className="mt-2 text-sm leading-6 text-slate-500">棒グラフ：内国債・借入金・政府短期証券の合計（兆円、6月末・12月末）。政府保証債務は含みません。</p>
        <div className="mt-5 overflow-x-auto" role="img" aria-label="国債及び借入金現在高の半年ごとの棒グラフ。数値は下の表で確認できます。">
          <div style={{ minWidth: width }}>
            <p className="mb-2 pl-4 text-xs text-slate-500">兆円</p>
            <div className="h-80"><ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={debt} margin={{ top: 12, right: 16, bottom: 12, left: 0 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" ticks={debt.filter(row => row.date.endsWith("-12-31")).map(row => row.date)} interval={0} angle={-55} textAnchor="end" height={65} tickMargin={8} tick={{ fontSize: 11 }} tickFormatter={(value: string) => `${value.slice(0, 4)}年12月`} />
                <YAxis width={65} domain={[0, "auto"]} tick={{ fontSize: 11 }} tickFormatter={(value: number) => value.toLocaleString("ja-JP")} />
                <Tooltip labelFormatter={value => `${value} 現在`} formatter={value => [`${number(Number(value))} 兆円`, "国債及び借入金現在高"]} />
                <Bar dataKey="amount" name="国債及び借入金現在高" fill="#93c5fd" maxBarSize={18} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer></div>
          </div>
        </div>
      </section>
      <section>
        <h4 className="font-semibold">一般会計予算に占める利払費</h4>
        <p className="mt-2 text-sm leading-6 text-slate-500">棒グラフ・左軸：利払費（兆円） ／ 折れ線・右軸：一般会計歳出総額に占める割合（%）。各年度の当初予算で比較しています。</p>
        <div className="mt-5 overflow-x-auto" role="img" aria-label="年度別の利払費と一般会計予算に占める割合。数値は下の表で確認できます。">
          <div style={{ minWidth: width }}>
            <div className="mb-2 flex justify-between pl-4 pr-2 text-xs text-slate-500"><span>兆円</span><span>一般会計歳出比（%）</span></div>
            <div className="h-80"><ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={budgets} margin={{ top: 12, right: 8, bottom: 12, left: 0 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="fiscalYear" interval={0} angle={-55} textAnchor="end" height={65} tickMargin={8} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value}年度`} />
                <YAxis yAxisId="amount" width={65} domain={[0, "auto"]} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="share" orientation="right" width={45} unit="%" domain={[0, "auto"]} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={value => `${value}年度 当初予算`} formatter={(value, name) => [`${number(Number(value))} ${name === "一般会計歳出比" ? "%" : "兆円"}`, name]} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar yAxisId="amount" dataKey="interest" name="利払費" fill="#fed7aa" maxBarSize={24} isAnimationActive={false} />
                <Line yAxisId="share" dataKey="share" name="一般会計歳出比" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer></div>
          </div>
        </div>
      </section>
    </div>
    <p className="mt-4 text-xs leading-5 text-slate-500">残高は国が保有する国債・国内部の借入金を含む国の総額で、地方政府を含む一般政府の連結債務や純債務ではありません。利払費は一般会計負担の国債等の利子・割引料の支払財源として国債整理基金特別会計へ繰り入れる額（年金特例公債分を含む）。元本償還費・事務取扱費は除きます。割合は利払費÷同年度の一般会計歳出当初予算×100で算定し、補正予算・決算とは区別しています。2000年度は省庁再編前後の大蔵省・財務省分を合算しています。</p>
    <details className="mt-5 border-t border-slate-100 pt-4 text-sm">
      <summary className="cursor-pointer font-medium text-sky-700">数値・出典を確認する</summary>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-right text-xs tabular-nums">
        <caption className="mb-2 text-left font-medium">国債及び借入金現在高（兆円）</caption>
        <thead><tr><th className="p-2 text-left" scope="col">観測日</th><th className="p-2" scope="col">残高</th></tr></thead>
        <tbody>{debt.map(row => <tr key={row.date} className="border-t border-slate-100"><th scope="row" className="p-2 text-left font-normal">{row.date}</th><td className="p-2">{number(row.amount)}</td></tr>)}</tbody>
      </table></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
        <caption className="mb-2 text-left font-medium">一般会計当初予算</caption>
        <thead><tr>{["年度", "利払費（兆円）", "歳出総額（兆円）", "歳出比（%）"].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
        <tbody>{budgets.map(row => <tr key={row.fiscalYear} className="border-t border-slate-100"><th scope="row" className="p-2 font-normal">{row.fiscalYear}</th><td className="p-2">{number(row.interest)}</td><td className="p-2">{number(row.budget)}</td><td className="p-2">{number(row.share)}</td></tr>)}</tbody>
      </table></div>
      <ul className="mt-4 space-y-2">{fiscal.sources.map(source => <li key={source.id}><a className="text-sky-700 underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></li>)}</ul>
    </details>
  </section>;
}
