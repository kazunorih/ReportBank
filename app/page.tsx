import Link from "next/link";
import { getArticles, MicroCmsArticle } from "@/lib/microcms";

export const dynamic = "force-dynamic";

export default async function Home() {
  let articles: MicroCmsArticle[] = [];
  let errorMessage = "";

  try {
    articles = await getArticles();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

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
            記事タイトルをクリックすると、microCMS から取得した記事の個別ページを表示します。
          </p>
        </section>

        {errorMessage ? (
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-semibold text-slate-950">サーバーエラー</h2>
            <p className="mt-4 text-slate-600">{errorMessage}</p>
            <p className="mt-4 text-slate-500">
              環境変数 <code>MICROCMS_SERVICE_ID</code> または <code>MICROCMS_API_KEY</code> が設定されているか、デプロイ設定を確認してください。
            </p>
          </section>
        ) : (
          <section className="grid gap-6">
            {articles.length === 0 ? (
              <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                <p className="text-slate-600">記事が見つかりませんでした。microCMS の設定を確認してください。</p>
              </div>
            ) : (
              articles.map((article: MicroCmsArticle) => (
                <article
                  key={article.id}
                  className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <Link
                        href={`/articles/${article.id}`}
                        className="text-2xl font-semibold text-slate-950 hover:text-sky-700"
                      >
                        {article.title}
                      </Link>
                      {article.publishedAt ? (
                        <p className="mt-2 text-sm text-slate-500">
                          公開日: {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
                        </p>
                      ) : null}
                    </div>
                    <p className="leading-7 text-slate-700">
                      {article.body ? article.body.slice(0, 180) + (article.body.length > 180 ? "…" : "") : "本文はありません。"}
                    </p>
                    <div>
                      <Link
                        href={`/articles/${article.id}`}
                        className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                      >
                        記事を読む
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </main>
  );
}
