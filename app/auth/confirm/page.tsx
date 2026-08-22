import AuthForm from "../auth-form";
import { confirmAction } from "../actions";
import { cookies } from "next/headers";

export default async function ConfirmPage() {
  const email = (await cookies()).get("reportbank_pending_email")?.value ?? "";
  return <main className="min-h-screen bg-slate-50 px-6 py-12"><section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><h1 className="text-3xl font-semibold">メールアドレスの確認</h1><p className="mt-3 text-slate-600">メールに届いた確認コードを入力してください。</p>{email ? <AuthForm action={confirmAction} mode="confirm" email={email} /> : <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">登録情報の有効期限が切れました。新規登録画面からやり直してください。</p>}</section></main>;
}
