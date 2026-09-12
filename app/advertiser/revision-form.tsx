"use client";

import { useActionState, useState } from "react";

import {
  submitAdRevisionAction,
  type AdRevisionFormState,
} from "./actions";

type RevisionFormProps = {
  adId: string;
  initialCompanyName: string;
  initialTitle: string;
  initialBody: string;
};

const initialState: AdRevisionFormState = {};

export default function RevisionForm({
  adId,
  initialCompanyName,
  initialTitle,
  initialBody,
}: RevisionFormProps) {
  const [state, action, pending] = useActionState(
    submitAdRevisionAction,
    initialState,
  );
  const [length, setLength] = useState(initialBody.length);

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="adId" value={adId} />
      <label className="grid gap-2 font-medium">
        会社名
        <input
          name="companyName"
          defaultValue={initialCompanyName}
          maxLength={100}
          required
          className="rounded-xl border border-slate-300 px-4 py-3"
        />
      </label>
      <label className="grid gap-2 font-medium">
        記事タイトル
        <input
          name="title"
          defaultValue={initialTitle}
          maxLength={100}
          required
          className="rounded-xl border border-slate-300 px-4 py-3"
        />
      </label>
      <label className="grid gap-2 font-medium">
        本文
        <textarea
          name="body"
          defaultValue={initialBody}
          maxLength={3000}
          required
          rows={16}
          onChange={(event) => setLength(event.target.value.length)}
          className="rounded-xl border border-slate-300 px-4 py-3"
        />
        <span className="text-right text-sm text-slate-500">
          {length.toLocaleString("ja-JP")} / 3,000字
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-rose-700">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="rounded-full bg-sky-700 px-6 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? "提出中…" : "修正版を審査に提出"}
      </button>
    </form>
  );
}
