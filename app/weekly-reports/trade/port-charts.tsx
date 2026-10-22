import { portTradeData } from "@/lib/reports/port-trade";
import { tradeMonth } from "@/lib/reports/trade";
import TradeCharts from "./trade-charts";

export default function PortCharts() {
  return <div className="space-y-8">
    <TradeCharts charts={portTradeData.charts} latestMonth={portTradeData.latestMonth} firstFigure={6} sourceUnit="千円" />
    <section className="rounded-2xl bg-white p-6 text-sm leading-7 text-slate-600" aria-labelledby="port-trade-sources">
      <h2 id="port-trade-sources" className="text-xl font-semibold text-slate-950">港別統計の出典・集計方法</h2>
      <p className="mt-4">出所：財務省・e-Stat「<a className="text-sky-700 underline" href="https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00350300&tstat=000001013143&cycle=1&tclass1=000001013229&tclass2=000001013230&cycle_facet=tclass1%3Atclass2&tclass3val=0&metadata=1&data=1" target="_blank" rel="noopener noreferrer">普通貿易統計・税関別品別国別表</a>」。対象期間は{tradeMonth(portTradeData.firstMonth)}～{tradeMonth(portTradeData.latestMonth)}です。</p>
      <p className="mt-3">各官署の品目・相手国別明細にある月別金額を合算しています。年次累計や品目の小計は加算していません。輸出はFOB、輸入はCIFの名目円建て金額で、原資料の千円を図表で兆円へ換算しています。「その他」は全官署の合計から上位8港の合計を差し引いた額です。</p>
      <p className="mt-3">港名は税関官署の3桁符号に対応する名称です。海港・空港以外の官署も全国合計と「その他」に含まれます。<a className="text-sky-700 underline" href="https://www.customs.go.jp/toukei/sankou/dgorder/a2.htm" target="_blank" rel="noopener noreferrer">税関符号表</a>に基づく通関地別の集計であり、貨物の実際の積卸港や国内の生産地・消費地を示すものではありません。</p>
      <p className="mt-3">過去年は12月分の原資料に収録された1～12月の月額、直近年は収録最新月までの公表値を使用しています。公表段階や改訂時点により、FIGURE01～04の総額と端数・過去値が異なる場合があります。</p>
      <p className="mt-3 text-xs">データ取得日：{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(portTradeData.retrievedAt))}</p>
      <details className="mt-4"><summary className="w-fit cursor-pointer rounded py-2 text-sky-700">年別の原資料を見る</summary><ul className="mt-2 space-y-2">{[...portTradeData.sources].reverse().map(source => <li key={`${source.year}-${source.direction}`}><a className="text-sky-700 underline" href={source.page} target="_blank" rel="noopener noreferrer">{source.year}年・{source.direction === 1 ? "輸出" : "輸入"}（参照{source.fileCount}ファイル）</a></li>)}</ul></details>
    </section>
  </div>;
}
