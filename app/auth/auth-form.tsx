"use client";

import { useActionState } from "react";
import type { AuthState } from "./actions";

export default function AuthForm({ action, mode, email = "" }: { action: (state: AuthState, data: FormData) => Promise<AuthState>; mode: "register" | "login" | "confirm"; email?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-8 grid gap-5">
      <label className="grid gap-2 text-sm font-medium">メールアドレス<input name="email" type="email" required defaultValue={email} readOnly={mode === "confirm"} className="rounded-xl border border-slate-300 px-4 py-3" /></label>
      {mode === "confirm" ? (
        <label className="grid gap-2 text-sm font-medium">確認コード<input name="code" inputMode="numeric" required className="rounded-xl border border-slate-300 px-4 py-3" /></label>
      ) : (
        <label className="grid gap-2 text-sm font-medium">パスワード<input name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} className="rounded-xl border border-slate-300 px-4 py-3" /></label>
      )}
      {state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}</p> : null}
      <button disabled={pending} className="rounded-full bg-sky-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? "処理中…" : mode === "register" ? "登録する" : mode === "login" ? "ログイン" : "確認する"}</button>
    </form>
  );
}
