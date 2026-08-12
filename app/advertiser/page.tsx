import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listAdvertiserAds } from "@/lib/db/ads";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/ads/types";

export default async function AdvertiserPage() {
  const user = await requireUser();
  const ads = await listAdvertiserAds(user.id);
  return <main className="mx-auto max-w-5xl px-6 py-12"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-sky-700">ADVERTISER</p><h1 className="mt-2 text-3xl font-semibold">広告申込・契約</h1></div><Link href="/advertiser/ads/new" className="rounded-full bg-sky-700 px-5 py-3 text-center font-semibold text-white">広告記事を申し込む</Link></div>
  <section className="mt-8 grid gap-4">{ads.length ? ads.map((ad) => <Link key={ad.adId} href={`/advertiser/ads/${ad.adId}`} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:ring-sky-300"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><h2 className="text-xl font-semibold">{ad.title}</h2><p className="mt-2 text-sm text-slate-500">{ad.companyName}</p></div><dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm"><dt className="text-slate-500">掲載状況</dt><dd>{STATUS_LABELS[ad.status]}</dd><dt className="text-slate-500">支払状況</dt><dd>{PAYMENT_LABELS[ad.paymentStatus]}</dd><dt className="text-slate-500">月額</dt><dd>{ad.monthlyAmount.toLocaleString("ja-JP")}円（税込）</dd></dl></div></Link>) : <div className="rounded-2xl bg-white p-8 text-slate-600 ring-1 ring-slate-200">申し込み済みの記事はありません。</div>}</section></main>;
}
