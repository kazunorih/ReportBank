import Link from "next/link";
import AuthForm from "../auth-form";
import { registerAction } from "../actions";

export default function RegisterPage() {
  return <main className="min-h-screen bg-slate-50 px-6 py-12"><section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><Link href="/" className="text-sm text-sky-700">← ホーム</Link><h1 className="mt-6 text-3xl font-semibold">広告主の新規登録</h1><p className="mt-3 text-slate-600">確認コードを受け取れるメールアドレスをご登録ください。</p><AuthForm action={registerAction} mode="register" /><p className="mt-6 text-sm text-slate-600">登録済みの方は <Link href="/auth/login" className="text-sky-700 underline">ログイン</Link></p></section></main>;
}
