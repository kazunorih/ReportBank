import Link from "next/link";

export default function SiteNav({ current }: { current: "home" | "weekly" | "info" }) {
  const links = [
    { id: "home", href: "/", label: "ホーム" },
    { id: "weekly", href: "/weekly-reports", label: "週次定点観測" },
    { id: "info", href: "/site-info", label: "サイト情報" },
  ];
  return (
    <nav aria-label="メインナビゲーション" className="text-sm text-slate-500">
      <ul className="flex flex-wrap items-center gap-2 sm:gap-3">
        {links.map((link, index) => (
          <li key={link.id} className="flex items-center gap-2 sm:gap-3">
            {index > 0 && <span aria-hidden="true">/</span>}
            <Link href={link.href} aria-current={current === link.id ? "page" : undefined}
              className={`rounded py-2 transition hover:text-sky-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${current === link.id ? "font-semibold text-sky-800" : ""}`}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
