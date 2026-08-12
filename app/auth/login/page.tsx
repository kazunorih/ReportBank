import Link from "next/link";
import AuthForm from "../auth-form";
import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const { confirmed } = await searchParams;
  return <main className="min-h-screen bg-slate-50 px-6 py-12"><section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><Link href="/" className="text-sm text-sky-700">← ホーム</Link><h1 className="mt-6 text-3xl font-semibold">広告主ログイン</h1>{confirmed ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">登録が完了しました。ログインしてください。</p> : null}<AuthForm action={loginAction} mode="login" /><p className="mt-6 text-sm text-slate-600">初めての方は <Link href="/auth/register" className="text-sky-700 underline">新規登録</Link></p></section></main>;
}
