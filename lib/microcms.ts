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

export type MicroCmsArticle = {
  title: string;
  content?: string;
  description?: string;
} & MicroCMSContentId &
  MicroCMSDate;

function getMicroCmsClient() {
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