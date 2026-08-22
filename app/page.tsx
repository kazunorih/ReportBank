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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <nav aria-label="パンくずリスト" className="text-sm text-slate-500">
          <ol>
            <li aria-current="page">ホーム</li>
          </ol>
        </nav>

        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              レポートバンク
              <br className="md:hidden" />
              記事一覧
            </h1>
            <Link
              href="/site-info"
              className="text-sm font-semibold text-sky-700 transition hover:text-sky-900 hover:underline"
            >
              サイト情報を見る →
            </Link>
          </div>
        </section>

        <section className="grid gap-6">
          {articles.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <p className="text-slate-600">
                工事中です。
              </p>
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
                      className="text-xl font-semibold text-slate-950 hover:text-sky-700"
                    >
                      {article.title}
                    </Link>

                    {article.publishedAt ? (
                      <p className="mt-2 text-sm text-slate-500">
                        公開日:{" "}
                        {new Date(article.publishedAt).toLocaleDateString(
                          "ja-JP"
                        )}
                      </p>
                    ) : null}
                  </div>



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

        {errorMessage ? (
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-semibold text-slate-950">
              サーバーエラー
            </h2>

            <p className="mt-4 whitespace-pre-wrap text-slate-600">
              {errorMessage}
            </p>

            <p className="mt-4 text-slate-500">
              環境変数 <code>MICROCMS_SERVICE_ID</code> または{" "}
              <code>MICROCMS_API_KEY</code> が設定されているか、デプロイ設定を確認してください。
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
