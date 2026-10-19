import Link from "next/link";

export default function ObservationTabs({ current }: { current: "macro" | "trade" }) {
  return <div>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">定点観測</h1>
    <nav aria-label="定点観測の種類" className="mt-5 flex flex-wrap gap-3">
      {[
        { id: "macro", href: "/weekly-reports", label: "週次マクロ金融観測" },
        { id: "trade", href: "/weekly-reports/trade", label: "月次貿易観測" },
      ].map(item => <Link key={item.id} href={item.href} aria-current={current === item.id ? "page" : undefined}
        className={`rounded-full border px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 ${current === item.id ? "border-sky-800 bg-sky-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-600 hover:text-sky-800"}`}>
        {item.label}
      </Link>)}
    </nav>
  </div>;
}
