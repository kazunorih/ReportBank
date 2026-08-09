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
          <p className="mt-3 text-slate-600">
            Google Analytics 4で計測した日別のページビュー（PV）です。
          </p>
        </header>

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
