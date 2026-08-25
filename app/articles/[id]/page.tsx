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
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-6 text-slate-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-sky-700 transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <span aria-hidden="true">←</span> 記事一覧
        </Link>

        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-10">
        <header className="mb-8 border-b border-slate-200 pb-8">
          {article.category ? (
            <Link
              href={`/?category=${encodeURIComponent(article.category.id)}`}
              className="mb-5 inline-flex min-h-11 items-center rounded-full bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              {article.category.name}
            </Link>
          ) : null}

          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
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
            className="article-content"
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
      </div>
    </main>
  );
}
