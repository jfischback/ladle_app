"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "@/app/actions/password";
import { Wordmark } from "@/components/Logo";

export function ResetForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, undefined);
  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="mb-8 flex justify-center"><Wordmark className="h-16 w-auto" /></div>
      <div className="card p-6">
        <h1 className="mb-1 text-2xl font-bold">Choose a new password</h1>
        <p className="mb-4 text-muted">For {email}</p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="password" className="label">New password</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
            <p className="mt-1 text-sm text-muted">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="label">Type it again</label>
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" />
          </div>
          {state?.error && <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save my new password"}</button>
        </form>
      </div>
    </div>
  );
}
