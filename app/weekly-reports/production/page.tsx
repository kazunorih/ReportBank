import type { Metadata } from "next";
import ObservationTabs from "../observation-tabs";
import ProductionCharts from "./production-charts";
import { productionData, productionReference } from "@/lib/reports/production";
import orders from "@/lib/reports/data/machinery-orders.json";
import gdpTotals from "@/lib/reports/data/gdp-totals.json";

export const metadata: Metadata = {
  title: "生産統計 | 定点観測 | ReportBank",
  description: "農業総産出額と食料自給率、第2次産業の名目GDP、産業機械の月次受注額、日本の名目・実質GDP推移を公表統計で確認します。",
};

export default function ProductionPage() {
  const retrieved = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(productionData.retrievedAt));
  const ordersRetrieved = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(orders.retrievedAt));
  const gdpRetrieved = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(gdpTotals.retrievedAt));
  return <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <ObservationTabs current="production" />
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold tracking-widest text-sky-700">REPORTBANK / PRODUCTION STATISTICS</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">生産統計</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">農業総産出額と食料自給率、第2次産業の名目GDP、産業機械の内需・輸出別受注額、全産業の名目GDPから、日本の生産と産業構造の推移を確認します。金額は各時点の価格による名目値です。</p>
        <p className="mt-4 text-xs text-slate-500">資料取得日：FIGURE01・02・04の産業別内訳 {retrieved}／FIGURE03 {ordersRetrieved}／FIGURE04の2025年名目総額・実質総額 {gdpRetrieved}</p>
      </header>
      <ProductionCharts />
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">出典・取得日</h2>
        <ul className="mt-4 space-y-4 text-sm">{productionData.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{source.name}（Excel）</a><p className="mt-1 text-xs text-slate-500">取得：{retrieved}</p></li>)}
          <li><a href={gdpTotals.indexUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">内閣府・{gdpTotals.releaseName}（{gdpTotals.releaseDate}公表）</a><p className="mt-1 text-xs leading-6 text-slate-500">FIGURE04の2025年名目GDP総額・1994～2025年実質GDP総額。取得：{gdpRetrieved}。</p><p className="mt-1 flex gap-4 text-xs">{gdpTotals.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{source.id === "nominal" ? "名目暦年CSV" : "実質暦年CSV"}</a>)}</p></li>
          <li><a href={orders.indexUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">日本産業機械工業会・産業機械受注状況（月次PDF）</a><p className="mt-1 text-xs leading-6 text-slate-500">FIGURE03：表1「産業機械 需要部門別受注状況」。取得：{ordersRetrieved}。原単位は百万円、表示は億円に換算。月別の数値表から採用資料を確認できます。</p></li>
          <li><a href={productionReference} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">内閣府・記者公表資料（フロー編、2025年12月23日）</a><p className="mt-1 text-xs leading-6 text-slate-500">第2次産業の分類を参照。公表資料の生産の表は構成比のため、実額には上記の公式Excelを使用しています。取得時点のExcelは改定を反映しており、公表時のPDFと数値が一致しない場合があります。</p></li>
        </ul>
      </section>
    </div>
  </main>;
}
