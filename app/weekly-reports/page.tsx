import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import SiteNav from "@/app/components/site-nav";
import { chartGroups } from "@/lib/reports/catalog";
import { getWeeklyReports } from "@/lib/reports/store";
import ReportCharts from "./report-charts";

export const metadata: Metadata = {
  title: "日本のマクロ金融環境 | 週次レポート | ReportBank",
  description: "日本の金利、株式市場、建設受注、貸出と日本銀行の資産を公表統計で確認する週次レポート。",
};
const formatTime = (date: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "short" }).format(new Date(date));

export default async function WeeklyReportsPage({ searchParams }: { searchParams: Promise<{ before?: string | string[] }> }) {
  await connection();
  const { before } = await searchParams;
  let result: Awaited<ReturnType<typeof getWeeklyReports>> | undefined;
  let failed = false;
  try { result = await getWeeklyReports(Array.isArray(before) ? before[0] : before); }
  catch (error) { console.error("Weekly report read failed", error); failed = true; }
  const report = result?.report;
  const stale = result?.stale;

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <SiteNav current="weekly" />
        <header className="border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold tracking-widest text-sky-700">REPORTBANK / WEEKLY REPORT</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">日本のマクロ金融環境</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">金利、市場、実体経済と金融機関の資産から、日本のお金の流れを定点観測します。</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">毎週金曜 23:00（日本時間）生成開始</span>
            <span className="rounded-full bg-white px-4 py-2 ring-1 ring-slate-200">生成・検証完了後に更新</span>
            {report && <span className="px-1 py-2">最終更新：{formatTime(report.generatedAt)}</span>}
          </div>
        </header>
        {stale && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">更新が遅れています。直近に正常生成されたレポートを表示しています。</p>}
        <section className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-xs font-semibold tracking-widest text-sky-300">WEEKLY INSIGHT</p>
          <h2 className="mt-2 text-xl font-semibold">資金循環の400字整理</h2>
          <p className="mt-3 text-xs leading-6 text-slate-300">AIによる推論です。公表機関の見解とは異なります。統計の時点・集計範囲を踏まえた考察としてお読みください。</p>
          <p className="mt-5 whitespace-pre-wrap text-base leading-8 sm:text-lg">{report?.summary || (failed ? "レポートを取得できませんでした。時間をおいて再度お試しください。" : "初回レポートの公開を準備しています。公表統計の収集・確認と文章の生成が完了すると、ここに掲載されます。")}</p>
          {report && <p className="mt-4 text-xs text-slate-400">{[...report.summary].length}字 / GPT-5.6-luna / 収集基準日 {report.asOf}</p>}
        </section>
        {report ? <>
          <p className="text-sm leading-7 text-slate-600">図表は直近30年・60半期です。残高・金利・株価は6月末と12月末、建設受注は半期の合計を表示します。未終了の半期は含めず、未公表・未取得の値は「—」とし、補間しません。</p>
          {report.warnings.length > 0 && <details className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" open><summary className="cursor-pointer font-semibold">データの収録範囲について</summary><ul className="mt-3 list-disc space-y-2 pl-5">{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
          <ReportCharts report={report} />
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">出典・参考資料</h2>
            <p className="mt-2 text-sm text-slate-500">集計・生成に使用した資料と取得日時を掲載しています。</p>
            <ul className="mt-5 divide-y divide-slate-100">{report.sources.map((source) => <li key={source.id} className="py-3"><a className="text-sm font-medium text-sky-700 underline underline-offset-4" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a><p className="mt-1 text-xs text-slate-500">取得：{formatTime(source.retrievedAt)}</p></li>)}</ul>
          </section>
        </> : <section className="grid gap-4 sm:grid-cols-2" aria-label="掲載予定の統計">{chartGroups.map((group) => <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{group.title}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{group.description}</p><p className="mt-4 text-xs text-sky-700">データ公開準備中</p></div>)}</section>}
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
