import { getArticles } from "@/lib/microcms";

export const dynamic = "force-dynamic";

export default async function Home() {
  const articles = await getArticles();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <section className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            microCMS Article Viewer
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            microCMS で公開された記事一覧
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            GitHub と AWS Amplify で公開する Next.js サイトです。microCMS の記事を読み取り、ページに表示します。
          </p>
        </section>

        <section className="grid gap-6">
          {articles.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <p className="text-slate-600">記事が見つかりませんでした。microCMS の設定を確認してください。</p>
            </div>
          ) : (
            articles.map((article) => (
              <article
                key={article.id}
                className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
              >
                <h2 className="text-2xl font-semibold text-slate-950">{article.title}</h2>
                {article.publishedAt ? (
                  <p className="mt-2 text-sm text-slate-500">
                    公開日: {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
                  </p>
                ) : null}
                {article.body ? (
                  <p className="mt-4 leading-7 text-slate-700">{article.body}</p>
                ) : (
                  <p className="mt-4 text-slate-600">本文はありません。</p>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
