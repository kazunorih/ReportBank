import type { Metadata } from "next";
import ObservationTabs from "../observation-tabs";
import ProductionCharts from "./production-charts";
import { productionData, productionReference } from "@/lib/reports/production";

export const metadata: Metadata = {
  title: "生産統計 | 定点観測 | ReportBank",
  description: "1975年からの農業総産出額と食料自給率、1994年からの第2次産業の名目GDPを公表統計で確認します。",
};

export default function ProductionPage() {
  const retrieved = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(productionData.retrievedAt));
  return <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <ObservationTabs current="production" />
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold tracking-widest text-sky-700">REPORTBANK / PRODUCTION STATISTICS</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">生産統計</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">農業総産出額と食料自給率、第2次産業の名目GDPから、日本の農業・工業の長期的な推移を確認します。金額はその年の価格による名目値です。</p>
        <p className="mt-4 text-xs text-slate-500">資料取得日：{retrieved}</p>
      </header>
      <ProductionCharts />
      <section className="rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">出典・取得日</h2>
        <ul className="mt-4 space-y-4 text-sm">{productionData.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{source.name}（Excel）</a><p className="mt-1 text-xs text-slate-500">取得：{retrieved}</p></li>)}
          <li><a href={productionReference} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">内閣府・記者公表資料（フロー編、2025年12月23日）</a><p className="mt-1 text-xs leading-6 text-slate-500">第2次産業の分類を参照。公表資料の生産の表は構成比のため、実額には上記の公式Excelを使用しています。取得時点のExcelは改定を反映しており、公表時のPDFと数値が一致しない場合があります。</p></li>
        </ul>
      </section>
    </div>
  </main>;
}
