"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteNav() {
  const pathname = usePathname();
  const current = pathname === "/" ? "home" : pathname.startsWith("/weekly-reports") ? "weekly" : pathname === "/site-info" ? "info" : undefined;
  const links = [
    { id: "home", href: "/", label: "記事一覧" },
    { id: "weekly", href: "/weekly-reports", label: "定点観測" },
    { id: "info", href: "/site-info", label: "サイト情報" },
  ];
  return (
    <nav aria-label="メインナビゲーション" className="text-lg font-semibold text-slate-700 sm:text-xl">
      <ul className="flex flex-wrap items-center gap-2 sm:gap-3">
        {links.map((link, index) => (
          <li key={link.id} className="flex items-center gap-2 sm:gap-3">
            {index > 0 && <span aria-hidden="true" className="font-normal text-slate-400">/</span>}
            <Link href={link.href} aria-current={current === link.id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded py-2 transition hover:text-sky-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${current === link.id ? "text-sky-800 underline decoration-2 underline-offset-8" : ""}`}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
