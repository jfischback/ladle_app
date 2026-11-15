"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, type ResetState } from "@/app/actions/password";
import { Wordmark } from "@/components/Logo";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestReset, undefined);
  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="mb-8 flex justify-center"><Wordmark className="h-16 w-auto" /></div>
      <div className="card p-6">
        <h1 className="mb-2 text-2xl font-bold">Forgot your password?</h1>
        {state?.done ? (
          <p role="status" className="rounded-xl bg-olive-soft px-3 py-2 text-olive-dark">{state.done}</p>
        ) : (
          <form action={action} className="space-y-4">
            <p className="text-muted">Enter the email you signed up with and we&apos;ll send you a link to choose a new one.</p>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="field" />
            </div>
            {state?.error && <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{state.error}</p>}
            <button className="btn-primary w-full" disabled={pending}>{pending ? "One moment…" : "Send me a link"}</button>
          </form>
        )}
      </div>
      <p className="mt-4 text-center"><Link href="/login" className="font-semibold text-olive-dark underline">Back to sign in</Link></p>
    </div>
  );
}
