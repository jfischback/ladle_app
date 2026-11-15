"use client";

import { useState, useTransition } from "react";
import { cancelInvite, createInvite, leaveHousehold, removeMember } from "../actions/household";

type Member = { id: string; label: string; email: string; owner: boolean };

export function HouseholdClient({ me, members, invites, canLeave }: { me: string; members: Member[]; invites: { code: string; expires: string }[]; canLeave: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const link = (code: string) => `${window.location.origin}/join/${code}`;
  const share = async (code: string) => {
    const url = link(code);
    try {
      if (navigator.share) await navigator.share({ title: "Join my Ladle household", text: "Plan dinners with me on Ladle:", url });
      else { await navigator.clipboard.writeText(url); setCopied(code); }
    } catch { /* closed the share sheet */ }
  };
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-3 text-xl font-semibold">Who&apos;s in</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream/70 p-3">
              <span><b>{m.label}</b>{m.id === me ? <span className="text-muted"> (you)</span> : null}{m.owner ? <span className="tag ml-1.5 px-2 py-0 text-xs">Owner</span> : null}<span className="block text-sm text-muted">{m.email}</span></span>
              {m.id !== me && !m.owner && (
                <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => confirm(`Remove ${m.label} from your household? They'll go back to their own recipes and plans.`) && start(() => removeMember(m.id))}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">Invite someone</h2>
        <p className="text-muted">Send them a link. It works once, for 7 days. If they don&apos;t have an account yet, they make one first.</p>
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
          setError(null);
          const r = await createInvite();
          if (r.error) setError(r.error);
          else if (r.code) await share(r.code);
        })}>💌 Create an invite link</button>
        {error && <p className="font-semibold text-terracotta-dark">{error}</p>}
        {invites.length > 0 && (
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i.code} className="flex flex-wrap items-center gap-2 rounded-2xl bg-oat p-3 text-sm">
                <code className="min-w-0 flex-1 truncate">/join/{i.code}</code>
                <span className="text-muted">until {new Date(i.expires).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                <button className="btn-secondary min-h-9 px-3 text-sm" onClick={() => share(i.code)}>{copied === i.code ? "Copied!" : "Share"}</button>
                <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(() => cancelInvite(i.code))}>Cancel</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canLeave && (
        <section className="card space-y-2 p-5">
          <h2 className="text-xl font-semibold">Leave this household</h2>
          <p className="text-muted">You&apos;ll go back to your own recipes and plans (anything you had before joining is still there).</p>
          <button className="btn-secondary" disabled={pending} onClick={() => confirm("Leave this household?") && start(() => leaveHousehold())}>Leave household</button>
        </section>
      )}
    </div>
  );
}
