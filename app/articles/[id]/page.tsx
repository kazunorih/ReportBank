import Link from "next/link";
import { notFound } from "next/navigation";

import { getArticle, type MicroCmsArticle } from "@/lib/microcms";

export const dynamic = "force-dynamic";

type ArticlePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;

  let article: MicroCmsArticle | null = null;

  try {
    article = await getArticle(id);
  } catch (error) {
    console.error(`記事ID「${id}」の取得に失敗しました。`, error);
    // notFound will render Next.js 404
    notFound();
  }

  if (!article) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-medium text-blue-700 hover:underline"
        >
          ← 記事一覧へ戻る
        </Link>

        <header className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold leading-tight">
            {article.title}
          </h1>

          {article.publishedAt && (
            <p className="mt-4 text-sm text-slate-500">
              公開日：
              {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
            </p>
          )}
        </header>

        {article.content ? (
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{
              __html: article.content,
            }}
          />
        ) : (
          <p className="text-slate-600">
            この記事には本文が登録されていません。
          </p>
        )}
      </article>
    </main>
  );
}
