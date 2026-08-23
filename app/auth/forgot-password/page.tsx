import Link from "next/link";

import { forgotPasswordAction } from "../actions";
import PasswordResetForm from "../password-reset-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Link href="/auth/login" className="text-sm text-sky-700">
          ← ログインへ戻る
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">パスワードの再設定</h1>
        <p className="mt-3 leading-7 text-slate-600">
          登録したメールアドレスへ、パスワード再設定用の確認コードを送信します。
        </p>
        <PasswordResetForm action={forgotPasswordAction} mode="request" />
      </section>
    </main>
  );
}
