import "server-only";

import {
  createClient,
  type MicroCMSContentId,
  type MicroCMSDate,
  type MicroCMSQueries,
} from "microcms-js-sdk";

const serviceDomain = process.env.MICROCMS_SERVICE_ID?.trim();
const apiKey = process.env.MICROCMS_API_KEY?.trim();

/**
 * microCMS管理画面に表示されている
 * 「APIのエンドポイント」と一致させてください。
 *
 * APIエンドポイントが blogs の場合は、
 * "articles" を "blogs" に変更します。
 */
const ARTICLE_ENDPOINT = "articles";
const CATEGORY_ENDPOINT = "categories";

export type MicroCmsCategory = {
  name: string;
} & MicroCMSContentId &
  MicroCMSDate;

export type MicroCmsArticle = {
  title: string;
  content?: string;
  description?: string;
  category?: MicroCmsCategory;
} & MicroCMSContentId &
  MicroCMSDate;

function getMicroCmsClient() {
  // Log presence of env vars (do NOT log their values) to help debugging in CI/runtime logs
  try {
    console.error("microCMS env presence: MICROCMS_SERVICE_ID=", Boolean(process.env.MICROCMS_SERVICE_ID));
    console.error("microCMS env presence: MICROCMS_API_KEY=", Boolean(process.env.MICROCMS_API_KEY));
  } catch {
    // ignore logging errors
  }

  if (!serviceDomain) {
    throw new Error(
      "MICROCMS_SERVICE_IDが設定されていません。環境変数を確認してください。",
    );
  }

  if (!apiKey) {
    throw new Error(
      "MICROCMS_API_KEYが設定されていません。環境変数を確認してください。",
    );
  }

  return createClient({
    serviceDomain,
    apiKey,
  });
}

export async function getArticles(
  queries?: MicroCMSQueries,
): Promise<MicroCmsArticle[]> {
  const client = getMicroCmsClient();

  const response = await client.getList<MicroCmsArticle>({
    endpoint: ARTICLE_ENDPOINT,
    queries: {
      limit: 100,
      orders: "-publishedAt",
      ...queries,
    },
  });

  return response.contents;
}

export async function getCategories(): Promise<MicroCmsCategory[]> {
  const client = getMicroCmsClient();

  const response = await client.getList<MicroCmsCategory>({
    endpoint: CATEGORY_ENDPOINT,
    queries: {
      limit: 100,
      orders: "createdAt",
    },
  });

  return response.contents;
}

export async function getArticlesByCategory(
  categoryId?: string,
): Promise<MicroCmsArticle[]> {
  return getArticles({
    depth: 1,
    filters: categoryId ? `category[equals]${categoryId}` : undefined,
  });
}

export async function getArticle(
  contentId: string,
  queries?: MicroCMSQueries,
): Promise<MicroCmsArticle> {
  if (!contentId) {
    throw new Error("記事IDが指定されていません。");
  }

  const client = getMicroCmsClient();

  return client.getListDetail<MicroCmsArticle>({
    endpoint: ARTICLE_ENDPOINT,
    contentId,
    queries,
  });
}
