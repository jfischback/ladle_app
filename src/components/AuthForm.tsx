"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, googleLogin, type FormState } from "@/app/actions/auth";
import { Wordmark } from "./Logo";

export function AuthForm({ mode, googleEnabled, next, invite, claim, inviteOnlyNote, resetDone }: { mode: "login" | "signup"; googleEnabled: boolean; next?: string; invite?: string; claim?: string; inviteOnlyNote?: boolean; resetDone?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : signup, undefined);
  const isLogin = mode === "login";
  return (
    <div className="mx-auto max-w-sm pt-6">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Wordmark className="h-16 w-auto" />
        <p className="text-lg text-muted">Dinner planned around what&apos;s on sale. You approve the cart.</p>
      </div>
      <div className="card p-6">
        <h1 className="mb-4 text-2xl font-bold">{isLogin ? "Sign in" : "Create your account"}</h1>
        {resetDone && <p className="mb-4 rounded-2xl bg-olive-soft p-3 font-semibold text-olive-dark">✓ Your password is changed. Sign in with the new one.</p>}
        {invite && <p className="mb-4 rounded-2xl bg-olive-soft p-3 font-semibold text-olive-dark">🎉 You&apos;re invited to Ladle! Make your account to start planning your family&apos;s dinners.</p>}
        {claim && <p className="mb-4 rounded-2xl bg-olive-soft p-3 font-semibold text-olive-dark">🔑 Owner&apos;s link. The account you make here keeps the recipes, plans, pantry and store connection already set up.</p>}
        {inviteOnlyNote && <p className="mb-4 rounded-2xl bg-ochre-soft p-3 text-sm">Ladle is invite-only right now. If someone sent you an invite link, open that link to sign up.</p>}
        {next?.startsWith("/join/") && <p className="mb-4 rounded-2xl bg-olive-soft p-3 font-semibold text-olive-dark">🏡 {isLogin ? "Sign in" : "Create an account"} to join the household you were invited to.</p>}
        <form action={action} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          {invite && <input type="hidden" name="invite" value={invite} />}
          {claim && <input type="hidden" name="claim" value={claim} />}
          {!isLogin && (
            <div>
              <label htmlFor="name" className="label">Your first name</label>
              <input id="name" name="name" autoComplete="given-name" className="field" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="field" />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={isLogin ? 1 : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="field"
            />
            {!isLogin && <p className="mt-1 text-sm text-muted">At least 8 characters.</p>}
            {isLogin && <p className="mt-1 text-right text-sm"><Link href="/forgot" className="font-semibold text-olive-dark underline">Forgot password?</Link></p>}
          </div>
          {state?.error && (
            <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">
              {state.error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? "One moment…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>
        {googleEnabled && (
          <>
            <div className="my-4 flex items-center gap-3 text-sm text-muted">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <form action={googleLogin}>
              <button className="btn-secondary w-full">Continue with Google</button>
            </form>
          </>
        )}
      </div>
      <p className="mt-4 text-center">
        {isLogin ? (
          <><Link href="/welcome" className="font-semibold text-olive-dark underline">How Ladle works</Link> · New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-olive-dark underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-olive-dark underline">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
