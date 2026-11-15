"use client";

import { useState, useTransition } from "react";
import { cancelInvite, createFamilyInvite, createInvite, leaveHousehold, removeMember } from "../actions/household";
import { memberResetLink } from "../actions/password";

type Member = { id: string; label: string; email: string; owner: boolean };

export function HouseholdClient({ me, members, invites, canLeave, isOwner }: { me: string; members: Member[]; invites: { code: string; expires: string; kind: "join" | "family" }[]; canLeave: boolean; isOwner: boolean }) {
  const [resetFor, setResetFor] = useState<{ id: string; url: string } | null>(null);
  const makeReset = (m: Member) => start(async () => {
    setError(null);
    const r = await memberResetLink(m.id);
    if (r.error) setError(r.error);
    else if (r.url) {
      setResetFor({ id: m.id, url: r.url });
      try {
        if (navigator.share) await navigator.share({ title: "Reset your Ladle password", text: "Here's a link to choose a new Ladle password (works once, for an hour):", url: r.url });
        else await navigator.clipboard.writeText(r.url);
      } catch { /* closed the share sheet */ }
    }
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const linkFor = (i: { code: string; kind: "join" | "family" }) => (i.kind === "family" ? `/signup?invite=${i.code}` : `/join/${i.code}`);
  const share = async (i: { code: string; kind: "join" | "family" }) => {
    const url = `${window.location.origin}${linkFor(i)}`;
    const text = i.kind === "family" ? "Try Ladle for planning your family's dinners:" : "Plan dinners with me on Ladle:";
    try {
      if (navigator.share) await navigator.share({ title: i.kind === "family" ? "You're invited to Ladle" : "Join my Ladle household", text, url });
      else { await navigator.clipboard.writeText(url); setCopied(i.code); }
    } catch { /* closed the share sheet */ }
  };
  const InviteList = ({ items }: { items: { code: string; expires: string; kind: "join" | "family" }[] }) =>
    items.length ? (
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.code} className="flex flex-wrap items-center gap-2 rounded-2xl bg-oat p-3 text-sm">
            <code className="min-w-0 flex-1 truncate">{linkFor(i)}</code>
            <span className="text-muted">until {new Date(i.expires).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <button className="btn-secondary min-h-9 px-3 text-sm" onClick={() => share(i)}>{copied === i.code ? "Copied!" : "Share"}</button>
            <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(() => cancelInvite(i.code))}>Cancel</button>
          </li>
        ))}
      </ul>
    ) : null;
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-3 text-xl font-semibold">Who&apos;s in</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream/70 p-3">
              <span><b>{m.label}</b>{m.id === me ? <span className="text-muted"> (you)</span> : null}{m.owner ? <span className="tag ml-1.5 px-2 py-0 text-xs">Owner</span> : null}<span className="block text-sm text-muted">{m.email}</span></span>
              {m.id !== me && !m.owner && (
                <span className="flex flex-wrap gap-1">
                  {isOwner && <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => makeReset(m)}>🔑 Reset link</button>}
                  <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => confirm(`Remove ${m.label} from your household? They'll go back to their own recipes and plans.`) && start(() => removeMember(m.id))}>Remove</button>
                </span>
              )}
              {resetFor?.id === m.id && (
                <p className="w-full rounded-xl bg-olive-soft p-2 text-sm text-olive-dark">Reset link for {m.label} (works once, for an hour, and it&apos;s copied): <code className="break-all">{resetFor.url}</code></p>
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
          else if (r.code) await share({ code: r.code, kind: "join" });
        })}>💌 Create an invite link</button>
        {error && <p className="font-semibold text-terracotta-dark">{error}</p>}
        <InviteList items={invites.filter((i) => i.kind === "join")} />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">Invite another family</h2>
        <p className="text-muted">A friend, a sister, another mom: a sign-up link so they can start Ladle with their own recipes and plans (separate from yours). Works once, for 14 days, even when sign-up is invite-only.</p>
        <button className="btn-secondary" disabled={pending} onClick={() => start(async () => {
          setError(null);
          const r = await createFamilyInvite();
          if (r.error) setError(r.error);
          else if (r.code) await share({ code: r.code, kind: "family" });
        })}>🎁 Create a family invite</button>
        <InviteList items={invites.filter((i) => i.kind === "family")} />
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
