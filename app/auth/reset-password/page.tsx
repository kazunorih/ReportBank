import Link from "next/link";
import { cookies } from "next/headers";

import { resetPasswordAction } from "../actions";
import PasswordResetForm from "../password-reset-form";

export default async function ResetPasswordPage() {
  const hasResetRequest = Boolean(
    (await cookies()).get("reportbank_reset_email")?.value,
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Link href="/auth/login" className="text-sm text-sky-700">
          ← ログインへ戻る
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">新しいパスワードを設定</h1>
        <p className="mt-3 leading-7 text-slate-600">
          メールに届いた確認コードと、新しいパスワードを入力してください。
        </p>
        {hasResetRequest ? (
          <PasswordResetForm action={resetPasswordAction} mode="confirm" />
        ) : (
          <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            再設定情報の有効期限が切れました。パスワード再設定を最初からやり直してください。
          </p>
        )}
      </section>
    </main>
  );
}
