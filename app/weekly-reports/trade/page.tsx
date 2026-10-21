import type { Metadata } from "next";
import { tradeData, tradeMonth } from "@/lib/reports/trade";
import ObservationTabs from "../observation-tabs";
import TradeCharts from "./trade-charts";
import FdiChart from "./fdi-chart";
import { getTradeInsight } from "@/lib/reports/trade-insight";

export const metadata: Metadata = {
  title: "月次貿易観測 | 定点観測 | ReportBank",
  description: "財務省・税関の貿易統計から、2000年1月からの月次輸出入を国別・品目別に観測します。商品の例と、JETROの年次対外直接投資残高も掲載。",
};

export default function MonthlyTradePage() {
  const insight = getTradeInsight();
  return <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">

      <ObservationTabs current="trade" />
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold tracking-widest text-sky-700">REPORTBANK / MONTHLY TRADE</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">日本の貿易と対外投資</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">財務省・税関の貿易統計から、国・地域と品目ごとの輸出入の推移を定点観測します。最新月の国別上位8か国・地域と品目別上位5品目を全期間で固定し、貿易構造の変化を比較します。あわせて、JETROの対外直接投資残高を年次で掲載しています。</p>
        <p className="mt-5 text-sm text-slate-600">輸出入の対象期間：{tradeMonth(tradeData.firstMonth)}～{tradeMonth(tradeData.latestMonth)}（{tradeData.sources.length}か月）。FIGURE05は年末の対外直接投資残高を掲載しています。</p>
        <p className="mt-3 text-xs leading-6 text-slate-500">品目分類の変更により現在の上位5区分を比較できない月は、品目別グラフを欠測とし、数値表に輸出入総額のみを掲載しています。</p>
      </header>
      <section className="max-w-3xl text-sm leading-7 text-slate-600" aria-labelledby="trade-insight-title">
        <h2 id="trade-insight-title">TRADE INSIGHT（資料からのAI推論・400字以内）</h2>
        <p className="mt-5 whitespace-pre-wrap">{insight?.summary ?? "図表の更新に合わせて、400字以内の要約を準備しています。"}</p>
        {insight && <p className="mt-3 text-xs text-slate-500">本文作成：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "short" }).format(new Date(insight.generatedAt))}。掲載中のFIGURE01～05に基づく整理です。</p>}
      </section>
      <TradeCharts charts={tradeData.charts} latestMonth={tradeData.latestMonth} />
      <FdiChart />
      <section className="rounded-2xl bg-white p-6 text-sm leading-7 text-slate-600">
        <h2 className="text-xl font-semibold text-slate-950">出典・集計方法</h2>
        <p className="mt-4">出典：財務省・税関「<a className="text-sky-700 underline" href="https://www.customs.go.jp/toukei/latest/index.htm" target="_blank" rel="noopener noreferrer">貿易統計（最新の発表）</a>」および「<a className="text-sky-700 underline" href="https://www.customs.go.jp/toukei/shinbun/happyou.htm" target="_blank" rel="noopener noreferrer">報道発表資料・月次XML／PDF</a>」。輸出はFOB価格、輸入はCIF価格の円建て金額です。季節調整はしていません。</p>
        <p className="mt-3">国別は国・地域を対象とし、EU・アジアなどの地域合計は順位に含めません。品目別は重複しない主要商品大分類を使い、「その他」を除く8分類から上位5品目を選びます。図表の「その他」は総額から国別は上位8か国・地域、品目別は上位5品目の合計を差し引いた金額です。</p>
        <p className="mt-3">原資料の百万円を兆円に換算しています。各月は取得時点の公表値を使い、速報・確報・確定値が混在します。後日の改訂により数値が変わる場合があります。</p>
        <p className="mt-3">データ取得日：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(tradeData.retrievedAt))}</p>
        <details className="mt-4"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700">月別の原資料を見る</summary><ul className="mt-2 space-y-2">{[...tradeData.sources].reverse().map(source => <li key={source.month}><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{source.sourceTitle}</a><span className="ml-2 text-xs">公表：{source.published}</span></li>)}</ul></details>
      </section>
    </div>
  </main>;
}
