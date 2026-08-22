import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import {
  getPageViewPeriods,
  type AnalyticsPeriod,
} from "@/lib/google-analytics";

import PageViewsChart from "./page-views-chart";

export const metadata: Metadata = {
  title: "サイト情報 | ReportBank",
  description: "ReportBankのGoogle Analytics 4によるページビュー統計です。",
};

export default async function SiteInfoPage() {
  await connection();

  let periods: AnalyticsPeriod[] = [];
  let errorMessage = "";

  try {
    periods = await getPageViewPeriods();
  } catch (error) {
    console.error("Google Analytics 4のPV数を取得できませんでした。", error);
    errorMessage =
      "アクセス統計を取得できませんでした。しばらくしてからもう一度お試しください。";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <nav aria-label="パンくずリスト" className="text-sm text-slate-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-sky-700 hover:underline">
                ホーム
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-slate-700">
              サイト情報
            </li>
          </ol>
        </nav>

        <header>
          <p className="text-sm font-semibold text-sky-700">SITE INFORMATION</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            サイト情報
          </h1>
        </header>

        <section
          aria-labelledby="advertising-heading"
          className="overflow-hidden rounded-3xl bg-sky-700 text-white shadow-sm"
        >
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-wide text-sky-100">
                ADVERTISING
              </p>
              <h2 id="advertising-heading" className="mt-2 text-2xl font-semibold">
                当サイトの記事の一つとして広告記事を掲載することが出来ます
              </h2>
              <p className="mt-4 inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950">
                現在、広告機能は準備中です
              </p>
              <p className="mt-4 max-w-2xl leading-7 text-sky-50">
                3,000字以内の広告記事をお申し込みいただけます。カード情報は
                Stripeが安全に取り扱い、ReportBankには保存されません。
              </p>

              <ol className="mt-6 grid gap-2 text-sm text-sky-50 sm:grid-cols-3">
                <li className="rounded-2xl bg-white/10 p-3">1. アカウント登録</li>
                <li className="rounded-2xl bg-white/10 p-3">2. 原稿を入力</li>
                <li className="rounded-2xl bg-white/10 p-3">3. Stripeで決済</li>
              </ol>
            </div>

            <div className="rounded-2xl bg-white p-6 text-slate-900">
            
              <p className="mt-2 text-3xl font-semibold">
                5,000円
                <span className="text-base font-normal text-slate-600">
                  ／月（税込）
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-600">
                先着枠終了後は月額50,000円（税込）です。
              </p>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/auth/register"
                  className="inline-flex justify-center rounded-full bg-sky-700 px-6 py-3 font-semibold text-white transition hover:bg-sky-800"
                >
                  準備中の申込画面を確認する
                </Link>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                  <Link
                    href="/auth/login"
                    className="font-semibold text-sky-700 hover:underline"
                  >
                    登録済みの方はこちら
                  </Link>
                  <Link
                    href="/advertise"
                    className="text-slate-600 hover:text-sky-700 hover:underline"
                  >
                    掲載条件を詳しく見る
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="text-slate-600">
          Google Analytics 4で計測した日別のページビュー（PV）です。
        </p>

        {errorMessage ? (
          <section
            className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-rose-200"
            role="alert"
          >
            <h2 className="text-xl font-semibold text-slate-950">アクセス統計</h2>
            <p className="mt-3 text-slate-600">{errorMessage}</p>
          </section>
        ) : (
          <div className="grid gap-8">
            {periods.map((period) => (
              <section
                key={period.key}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"
              >
                <div className="mb-6 flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-semibold text-slate-950">
                    {period.label}
                  </h2>
                  <p className="text-right text-sm text-slate-500">
                    合計{" "}
                    <strong className="ml-1 text-3xl font-semibold tabular-nums text-sky-700">
                      {period.total.toLocaleString("ja-JP")}
                    </strong>{" "}
                    PV
                  </p>
                </div>
                <PageViewsChart data={period.points} label={period.label} />
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
