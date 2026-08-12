import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/session";

export default async function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4"><Link href="/advertiser" className="font-semibold">ReportBank 広告主マイページ</Link><div className="flex items-center gap-4 text-sm"><span className="hidden text-slate-500 sm:inline">{user.email}</span>{user.isAdmin ? <Link href="/admin/ads" className="text-sky-700">管理画面</Link> : null}<form action={logoutAction}><button className="text-slate-600 hover:text-slate-950">ログアウト</button></form></div></div></header>{children}</div>;
}
