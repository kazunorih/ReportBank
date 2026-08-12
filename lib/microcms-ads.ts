import type { AdContract } from "@/lib/ads/types";

function config() {
  const serviceId = process.env.MICROCMS_SERVICE_ID?.trim();
  const writeKey = process.env.MICROCMS_ADS_WRITE_API_KEY?.trim();
  const managementKey = process.env.MICROCMS_MANAGEMENT_API_KEY?.trim();
  const endpoint = process.env.MICROCMS_ADS_ENDPOINT?.trim() || "articles";
  if (!serviceId || !writeKey) throw new Error("microCMS広告書き込み設定が不足しています。");
  return { serviceId, writeKey, managementKey, endpoint };
}

export async function upsertMicroCmsDraft(ad: AdContract) {
  const { serviceId, writeKey, endpoint } = config();
  const response = await fetch(`https://${serviceId}.microcms.io/api/v1/${endpoint}/${ad.adId}?status=draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-MICROCMS-API-KEY": writeKey },
    // 現在のarticles APIに存在する既存フィールドだけを送る。
    body: JSON.stringify({ title: ad.title, content: ad.body.replace(/\n/g, "<br>") }),
  });
  if (!response.ok) throw new Error(`microCMS下書き作成に失敗しました (${response.status})`);
  return ad.adId;
}

export async function changeMicroCmsStatus(contentId: string, status: "PUBLISH" | "DRAFT") {
  const { serviceId, managementKey, endpoint } = config();
  if (!managementKey) throw new Error("MICROCMS_MANAGEMENT_API_KEYが設定されていません。");
  const response = await fetch(`https://${serviceId}.microcms-management.io/api/v1/contents/${endpoint}/${contentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-MICROCMS-API-KEY": managementKey },
    body: JSON.stringify({ status: [status] }),
  });
  if (!response.ok) throw new Error(`microCMS公開状態の変更に失敗しました (${response.status})`);
}
