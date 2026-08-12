import Link from "next/link";
import AdForm from "../../ad-form";

export default function NewAdPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12"><Link href="/advertiser" className="text-sm text-sky-700">← マイページ</Link><h1 className="mt-6 text-3xl font-semibold">広告記事の申し込み</h1><div className="mt-6 rounded-2xl bg-sky-50 p-5 text-sm text-sky-950"><p className="font-semibold">月額料金</p><p className="mt-2">先着5件は月額5,000円（税込）、以降は月額50,000円（税込）です。追加の消費税はかかりません。</p><p className="mt-2">初回のお支払い後、毎月自動更新されます。掲載解除は現在の支払期間の終了時に反映されます。</p></div><section className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><AdForm /></section></main>;
}
