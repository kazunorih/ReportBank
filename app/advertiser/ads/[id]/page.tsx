import Link from "next/link";
import { notFound } from "next/navigation";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/ads/types";
import { requireUser } from "@/lib/auth/session";
import { getAd } from "@/lib/db/ads";
import { requestCancellationAction, startCheckoutAction } from "../../actions";

export default async function AdPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser(); const { id } = await params; const ad = await getAd(user.id, id); if (!ad) notFound(); const query = await searchParams;
  return <main className="mx-auto max-w-3xl px-6 py-12"><Link href="/advertiser" className="text-sm text-sky-700">← マイページ</Link>{query.checkout === "cancelled" ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900">決済は完了していません。原稿は保存されています。</p> : null}<section className="mt-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><h1 className="text-3xl font-semibold">{ad.title}</h1><p className="mt-2 text-slate-500">{ad.companyName}</p><dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-y border-slate-200 py-6"><dt className="text-slate-500">掲載状況</dt><dd>{STATUS_LABELS[ad.status]}</dd><dt className="text-slate-500">支払状況</dt><dd>{PAYMENT_LABELS[ad.paymentStatus]}</dd><dt className="text-slate-500">月額料金</dt><dd>{ad.monthlyAmount.toLocaleString("ja-JP")}円（税込）</dd>{ad.currentPeriodEnd ? <><dt className="text-slate-500">現在の期間終了</dt><dd>{new Date(ad.currentPeriodEnd).toLocaleDateString("ja-JP")}</dd></> : null}</dl><div className="mt-8 whitespace-pre-wrap leading-8">{ad.body}</div>
  {ad.status === "draft" ? <div className="mt-8"><p className="mb-4 text-sm text-slate-600">Stripe Checkoutでカード情報を入力します。ReportBankはカード番号を保存しません。表示料金は税込で、追加の消費税はかかりません。</p><form action={startCheckoutAction}><input type="hidden" name="adId" value={ad.adId} /><button className="rounded-full bg-sky-700 px-6 py-3 font-semibold text-white">月額課金を申し込む</button></form></div> : null}
  {["under_review", "published", "payment_failed"].includes(ad.status) ? <form action={requestCancellationAction} className="mt-8 border-t border-slate-200 pt-6"><input type="hidden" name="adId" value={ad.adId} /><p className="mb-4 text-sm text-slate-600">掲載解除を申請すると、現在の支払期間の終了時に課金と掲載を終了します。即時返金は行いません。</p><button className="rounded-full border border-rose-300 px-5 py-2 font-semibold text-rose-700">掲載解除を申請</button></form> : null}</section></main>;
}
