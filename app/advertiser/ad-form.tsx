"use client";
import { useActionState, useState } from "react";
import { createAdAction } from "./actions";

export default function AdForm() {
  const [state, action, pending] = useActionState(createAdAction, {});
  const [length, setLength] = useState(0);
  return <form action={action} className="grid gap-6">
    <label className="grid gap-2 font-medium">会社名<input name="companyName" maxLength={100} required className="rounded-xl border border-slate-300 px-4 py-3" /></label>
    <label className="grid gap-2 font-medium">記事タイトル<input name="title" maxLength={100} required className="rounded-xl border border-slate-300 px-4 py-3" /></label>
    <label className="grid gap-2 font-medium">本文<textarea name="body" maxLength={3000} required rows={16} onChange={(event) => setLength(event.target.value.length)} className="rounded-xl border border-slate-300 px-4 py-3" /><span className="text-right text-sm text-slate-500">{length.toLocaleString("ja-JP")} / 3,000字</span></label>
    {state.error ? <p role="alert" className="text-rose-700">{state.error}</p> : null}
    <button disabled={pending} className="rounded-full bg-sky-700 px-6 py-3 font-semibold text-white disabled:opacity-60">{pending ? "保存中…" : "原稿を保存して料金を確認"}</button>
  </form>;
}
