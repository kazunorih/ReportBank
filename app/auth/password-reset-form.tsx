"use client";

import { useActionState } from "react";

import type { AuthState } from "./actions";

type Props = {
  action: (state: AuthState, data: FormData) => Promise<AuthState>;
  mode: "request" | "confirm";
};

export default function PasswordResetForm({ action, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="mt-8 grid gap-5">
      {mode === "request" ? (
        <label className="grid gap-2 text-sm font-medium">
          メールアドレス
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
        </label>
      ) : (
        <>
          <label className="grid gap-2 text-sm font-medium">
            確認コード
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className="rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            新しいパスワード
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              className="rounded-xl border border-slate-300 px-4 py-3"
            />
            <span className="font-normal text-slate-500">
              8文字以上で、小文字・数字を含めてください。
            </span>
          </label>
        </>
      )}

      {state.error ? (
        <p role="alert" className="text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}

      <button
        disabled={pending}
        className="rounded-full bg-sky-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending
          ? "処理中…"
          : mode === "request"
            ? "確認コードを送信"
            : "パスワードを変更"}
      </button>
    </form>
  );
}
