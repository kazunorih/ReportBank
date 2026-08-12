import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="min-h-screen bg-slate-100"><header className="border-b border-slate-300 bg-slate-950 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/admin/ads" className="font-semibold">ReportBank 広告管理</Link><Link href="/advertiser" className="text-sm text-slate-300">広告主画面</Link></div></header>{children}</div>;
}
