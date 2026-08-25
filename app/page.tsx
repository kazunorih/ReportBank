import Link from "next/link";
import {
  getArticlesByCategory,
  getCategories,
  MicroCmsArticle,
  MicroCmsCategory,
} from "@/lib/microcms";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const requestedCategory = Array.isArray(query.category)
    ? query.category[0]
    : query.category;
  let articles: MicroCmsArticle[] = [];
  let categories: MicroCmsCategory[] = [];
  let selectedCategory: MicroCmsCategory | undefined;
  let errorMessage = "";

  try {
    categories = await getCategories();
    selectedCategory = categories.find(
      (category) => category.id === requestedCategory,
    );
    articles = await getArticlesByCategory(selectedCategory?.id);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="パンくずリスト" className="text-sm text-slate-500">
          <ol>
            <li aria-current="page">ホーム</li>
          </ol>
        </nav>

        <section className="border-b border-slate-200 pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold tracking-wide text-sky-700">
                REPORTBANK
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              レポートバンク
              <br className="md:hidden" />
              記事一覧
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                産業・企業・歴史から、事業機会を読み解くレポートを掲載しています。
              </p>
            </div>
            <Link
              href="/site-info"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-sky-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              サイト情報
            </Link>
          </div>
        </section>

        <nav aria-label="記事カテゴリ" className="overflow-x-auto pb-1">
          <div className="flex w-max min-w-full gap-1 rounded-2xl bg-slate-200/70 p-1.5">
            <Link
              href="/"
              aria-current={!selectedCategory ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                !selectedCategory
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
              }`}
            >
              すべて
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/?category=${encodeURIComponent(category.id)}`}
                aria-current={selectedCategory?.id === category.id ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                  selectedCategory?.id === category.id
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
                }`}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {selectedCategory ? selectedCategory.name : "すべての記事"}
          </h2>
          <p className="shrink-0 text-sm text-slate-500">{articles.length}件</p>
        </div>

        <section className="grid gap-6">
          {articles.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
              <p className="font-semibold text-slate-900">準備中です</p>
              <p className="mt-2 text-sm text-slate-500">
                このカテゴリの記事は、公開までしばらくお待ちください。
              </p>
            </div>
          ) : (
            articles.map((article: MicroCmsArticle) => (
              <article
                key={article.id}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-8"
              >
                <div className="flex flex-col gap-5">
                  <div>
                    {article.category ? (
                      <Link
                        href={`/?category=${encodeURIComponent(article.category.id)}`}
                        className="mb-3 inline-flex min-h-11 items-center rounded-full bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                      >
                        {article.category.name}
                      </Link>
                    ) : null}
                    <Link
                      href={`/articles/${article.id}`}
                      className="block text-xl font-semibold leading-8 tracking-tight text-slate-950 transition hover:text-sky-700 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 sm:text-2xl"
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



                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <Link
                      href={`/articles/${article.id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-sky-700 transition hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                    >
                      記事を読む <span aria-hidden="true">→</span>
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
