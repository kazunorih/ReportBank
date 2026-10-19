import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import SiteNav from "@/app/components/site-nav";
import { chartGroups } from "@/lib/reports/catalog";
import { getWeeklyReports } from "@/lib/reports/store";
import ReportCharts from "./report-charts";
import { getMarketChart } from "@/lib/reports/markets";
import { withReportFigures } from "@/lib/reports/boj";
import ObservationTabs from "./observation-tabs";

export const metadata: Metadata = {
  title: "週次マクロ金融観測 | 定点観測 | ReportBank",
  description: "日本の金利、株式市場、貸出、日本銀行の資産、政府債務、所得と失業率を公表統計で確認する週次マクロ金融観測。",
};
const formatTime = (date: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "short" }).format(new Date(date));

export default async function WeeklyReportsPage({ searchParams }: { searchParams: Promise<{ before?: string | string[] }> }) {
  await connection();
  const { before } = await searchParams;
  let result: Awaited<ReturnType<typeof getWeeklyReports>> | undefined;
  let failed = false;
  try { result = await getWeeklyReports(Array.isArray(before) ? before[0] : before); }
  catch (error) { console.error("Weekly report read failed", error); failed = true; }
  let marketChart: Awaited<ReturnType<typeof getMarketChart>> | undefined;
  try { marketChart = await getMarketChart(); }
  catch (error) { console.error("Market chart read failed", error); failed = true; }
  const insight = marketChart?.insight;
  const chartData = marketChart ? withReportFigures(marketChart) : undefined;

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <SiteNav current="weekly" />
        <ObservationTabs current="macro" />
        <header className="border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold tracking-widest text-sky-700">REPORTBANK / WEEKLY REPORT</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">日本のマクロ金融環境</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">金利・TOPIX、国内銀行の貸出、日本銀行の資産、政府の債務と利払い負担、世帯所得と失業率から、日本の金融環境を定点観測します。</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">毎週金曜 23:00（日本時間）生成開始</span>
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">生成・検証完了後に更新</span>
            {insight && <span className="px-1 py-2">本文作成：{formatTime(insight.generatedAt)}</span>}
          </div>
        </header>
        <section className="max-w-3xl text-sm leading-7 text-slate-600">
          <h2>WEEKLY INSIGHT（資料からのAI推論）</h2>
          <p className="mt-5 whitespace-pre-wrap">{insight?.summary || (failed ? "レポートを取得できませんでした。時間をおいて再度お試しください。" : "この図表のデータに基づく400字以内の整理を準備しています。")}</p>
        </section>
        {marketChart && chartData ? <>
          <p className="text-sm leading-7 text-slate-600">FIGURE01～04の収集基準日：{marketChart.asOf}。貸出残高は日本銀行の提供CSVを使用（最新観測日：{chartData.series.find((series) => series.id === "otherLoans")?.latestDate}）。日本銀行の資産は財務諸表を使用（最新決算日：{chartData.series.find((series) => series.id === "bojStatementJgb")?.latestDate}）。</p>
          <ReportCharts report={chartData} />
          <section className="rounded-2xl bg-white p-6"><h2 className="text-xl font-semibold">出典・取得日時</h2><ul className="mt-4 space-y-3">{chartData.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 underline">{source.name}</a><p className="text-xs text-slate-500">取得：{formatTime(source.retrievedAt)}</p></li>)}</ul></section>
        </> : <section className="grid gap-4 sm:grid-cols-2" aria-label="掲載予定の統計">{chartGroups.filter((group) => group.id === "markets").map((group) => <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{group.title}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{group.description}</p><p className="mt-4 text-xs text-sky-700">データ公開準備中</p></div>)}</section>}
        <section className="border-t border-slate-200 pt-8">
          <h2 className="text-2xl font-semibold">過去の400字整理</h2>
          <p className="mt-2 text-sm text-slate-500">作成日時点のAIによる推論を、そのまま保存しています。</p>
          <div className="mt-6 space-y-4">{result?.history.length ? result.history.map((entry) => <article key={entry.date} className="rounded-2xl border border-slate-200 bg-white p-6"><time dateTime={entry.generatedAt} className="text-sm font-semibold text-sky-700">{formatTime(entry.generatedAt)}</time><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{entry.summary}</p></article>) : <p className="py-6 text-sm text-slate-500">{failed ? "過去の整理を取得できませんでした。" : "公開済みの整理はまだありません。"}</p>}</div>
          <div className="mt-6 flex gap-6 text-sm font-semibold text-sky-700">{before && <Link href="/weekly-reports">最新へ戻る</Link>}{result?.nextCursor && <Link href={`/weekly-reports?before=${encodeURIComponent(result.nextCursor)}`}>さらに過去の整理を見る →</Link>}</div>
        </section>
      </div>
    </main>
  );
}
