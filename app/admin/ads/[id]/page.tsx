import Link from "next/link";
import { notFound } from "next/navigation";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/ads/types";
import { getAd } from "@/lib/db/ads";
import { publishAdAction } from "../actions";

export default async function AdminAdPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ advertiserId?: string }> }) {
  const { id } = await params; const { advertiserId } = await searchParams; if (!advertiserId) notFound(); const ad = await getAd(advertiserId, id); if (!ad) notFound();
  return <main className="mx-auto max-w-4xl px-6 py-12"><Link href="/admin/ads" className="text-sm text-sky-700">← 一覧</Link><article className="mt-6 rounded-3xl bg-white p-8 ring-1 ring-slate-200"><h1 className="text-3xl font-semibold">{ad.title}</h1><p className="mt-2 text-slate-500">{ad.companyName}</p><dl className="mt-6 grid grid-cols-[auto_1fr] gap-3 border-y border-slate-200 py-5"><dt>掲載状況</dt><dd>{STATUS_LABELS[ad.status]}</dd><dt>支払状況</dt><dd>{PAYMENT_LABELS[ad.paymentStatus]}</dd><dt>料金</dt><dd>{ad.monthlyAmount.toLocaleString("ja-JP")}円（税込）</dd><dt>microCMS ID</dt><dd>{ad.microCmsContentId ?? "未作成"}</dd></dl><div className="mt-8 whitespace-pre-wrap leading-8">{ad.body}</div>{ad.status === "under_review" && ad.paymentStatus === "paid" ? <form action={publishAdAction} className="mt-8"><input type="hidden" name="advertiserId" value={ad.advertiserId} /><input type="hidden" name="adId" value={ad.adId} /><button className="rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white">審査を完了して公開</button></form> : null}</article></main>;
}
