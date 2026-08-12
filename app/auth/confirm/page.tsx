import AuthForm from "../auth-form";
import { confirmAction } from "../actions";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <main className="min-h-screen bg-slate-50 px-6 py-12"><section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><h1 className="text-3xl font-semibold">メールアドレスの確認</h1><p className="mt-3 text-slate-600">メールに届いた確認コードを入力してください。</p><AuthForm action={confirmAction} mode="confirm" email={email ?? ""} /></section></main>;
}
