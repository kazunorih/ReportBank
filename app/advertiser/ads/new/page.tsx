import Link from "next/link";
import AdForm from "../../ad-form";

export default function NewAdPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12"><Link href="/advertiser" className="text-sm text-sky-700">← マイページ</Link><h1 className="mt-6 text-3xl font-semibold">広告記事の申し込み</h1><div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-950 ring-1 ring-amber-200"><p className="font-semibold">広告機能は現在準備中です</p><p className="mt-2">動作確認が完了するまでは、実際の決済を行わないでください。</p></div><div className="mt-5 rounded-2xl bg-sky-50 p-5 text-sm text-sky-950"><p className="font-semibold">1記事ごとの月額契約</p><p className="mt-2">先着5件は月額5,000円（税込）、以降は月額50,000円（税込）です。広告記事ごとに個別のStripeサブスクリプションを作成します。</p><p className="mt-2">解約はStripe公式画面で行い、現在の支払期間終了時に課金と掲載を終了します。</p></div><section className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><AdForm /></section></main>;
}
