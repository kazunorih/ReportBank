import { notFound } from "next/navigation";
import { getArticle } from "@/lib/microcms";

export const dynamic = "force-dynamic";

type Props = {
  params: {
    id: string;
  };
};

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle(params.id);

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <article className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            microCMS Article
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {article.title}
          </h1>
          {article.publishedAt ? (
            <p className="mt-3 text-sm text-slate-500">
              公開日: {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
            </p>
          ) : null}
          <div className="mt-8 space-y-6 leading-8 text-slate-700">
            {article.body ? (
              <p>{article.body}</p>
            ) : (
              <p>本文はありません。</p>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
