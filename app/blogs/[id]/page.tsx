import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle } from "@/lib/microcms";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BlogDetailPage({
  params,
}: BlogDetailPageProps) {
  const { id } = await params;

  let article;

  try {
    article = await getArticle(id);
  } catch (error) {
    console.error(`記事の取得に失敗しました。contentId: ${id}`, error);

    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-semibold text-sky-700 transition hover:text-sky-900"
          >
            ← 記事一覧に戻る
          </Link>
        </div>

        <article className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
          <header className="border-b border-slate-200 pb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {article.title}
            </h1>

            {article.publishedAt ? (
              <p className="mt-4 text-sm text-slate-500">
                公開日:{" "}
                {new Date(article.publishedAt).toLocaleDateString(
                  "ja-JP"
                )}
              </p>
            ) : null}
          </header>

          <div
            className={[
              "mt-8 max-w-none leading-8 text-slate-800",
              "[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold",
              "[&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold",
              "[&_p]:my-5",
              "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6",
              "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6",
              "[&_li]:my-2",
              "[&_a]:text-sky-700 [&_a]:underline",
              "[&_blockquote]:my-6 [&_blockquote]:border-l-4",
              "[&_blockquote]:border-slate-300",
              "[&_blockquote]:pl-4 [&_blockquote]:text-slate-600",
              "[&_img]:my-8 [&_img]:h-auto [&_img]:max-w-full",
              "[&_img]:rounded-xl",
            ].join(" ")}
            dangerouslySetInnerHTML={{
              __html: article.content ?? "",
            }}
          />
        </article>
      </div>
    </main>
  );
}