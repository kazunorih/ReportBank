"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getAd, updateAdStatus } from "@/lib/db/ads";
import { changeMicroCmsStatus } from "@/lib/microcms-ads";

export async function publishAdAction(formData: FormData) {
  await requireAdmin();
  const advertiserId = String(formData.get("advertiserId") ?? "");
  const adId = String(formData.get("adId") ?? "");
  const ad = await getAd(advertiserId, adId);
  if (!ad || ad.status !== "under_review" || ad.paymentStatus !== "paid" || !ad.microCmsContentId) throw new Error("公開条件を満たしていません。");
  await changeMicroCmsStatus(ad.microCmsContentId, "PUBLISH");
  await updateAdStatus(advertiserId, adId, "published", "paid", { publishedAt: new Date().toISOString() });
  revalidatePath("/"); revalidatePath("/admin/ads"); revalidatePath(`/admin/ads/${adId}`);
}
