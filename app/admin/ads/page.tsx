import Link from "next/link";
import { STATUS_LABELS, type AdStatus } from "@/lib/ads/types";
import { listAdsByStatus } from "@/lib/db/ads";

export default async function AdminAdsPage() {
  const statuses: AdStatus[] = ["under_review", "published", "cancellation_scheduled", "payment_failed", "ended"];
  const groups = await Promise.all(statuses.map(async (status) => [status, await listAdsByStatus(status)] as const));
  return <main className="mx-auto max-w-6xl px-6 py-12"><h1 className="text-3xl font-semibold">広告記事の審査・契約管理</h1><div className="mt-8 grid gap-8">{groups.map(([status, ads]) => <section key={status}><h2 className="text-xl font-semibold">{STATUS_LABELS[status]} <span className="text-sm font-normal text-slate-500">({ads.length})</span></h2><div className="mt-3 grid gap-3">{ads.map((ad) => <Link key={ad.adId} href={`/admin/ads/${ad.adId}?advertiserId=${encodeURIComponent(ad.advertiserId)}`} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 hover:ring-sky-400"><div className="flex justify-between gap-4"><span className="font-semibold">{ad.title}</span><span>{ad.monthlyAmount.toLocaleString("ja-JP")}円（税込）</span></div><p className="mt-2 text-sm text-slate-500">{ad.companyName} / {ad.advertiserId}</p></Link>)}</div></section>)}</div></main>;
}
