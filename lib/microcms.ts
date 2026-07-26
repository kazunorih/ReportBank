export type MicroCmsArticle = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

export async function getArticles(): Promise<MicroCmsArticle[]> {
  const serviceId = process.env.MICROCMS_SERVICE_ID;
  const apiKey = process.env.MICROCMS_API_KEY;

  if (!serviceId || !apiKey) {
    throw new Error(
      "microCMS の接続には MICROCMS_SERVICE_ID と MICROCMS_API_KEY の両方が必要です。"
    );
  }

  const response = await fetch(
    `https://${serviceId}.microcms.io/api/v1/articles?limit=20`,
    {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 60,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `microCMS API の取得に失敗しました: ${response.status} ${response.statusText}\n${text}`
    );
  }

  const json = await response.json();
  return Array.isArray(json.contents) ? json.contents : [];
}
