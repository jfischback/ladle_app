"use client";

import { useState, useTransition } from "react";
import { addCaredFor, inviteCaredFor, removeCaredFor, switchToCaredFor, switchToMyFamily } from "@/app/actions/care";

type Person = { id: string; label: string; current: boolean };

/** Caregiver mode: the people this family plans for (an aging parent), and switching between households. */
export function CareClient({ people, acting, loginOn, origin }: { people: Person[]; acting: boolean; loginOn: boolean; origin: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ who: string; url: string } | null>(null);
  return (
    <section id="care" aria-labelledby="care-title" className="card scroll-mt-24 space-y-4 p-5">
      <div>
        <h2 id="care-title" className="text-2xl font-semibold">🤝 Plan for someone else</h2>
        <p className="text-muted">
          Caring for a parent or grandparent? Give them their own plan, grocery list, pantry and Fry&apos;s cart, run from your phone.
          Switch between your family and theirs anytime.
        </p>
      </div>

      {people.length > 0 && (
        <ul className="space-y-2">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream p-3">
              <span className="font-bold">{p.label}{p.current && <span className="ml-2 rounded-full bg-olive px-2 py-0.5 text-xs text-cream">planning now</span>}</span>
              <span className="flex flex-wrap gap-1.5">
                {!p.current && <button type="button" className="btn-primary min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(() => switchToCaredFor(p.id).then((r) => { if (r?.error) setError(r.error); }))}>Plan for {p.label}</button>}
                {loginOn && (
                  <button type="button" className="btn-quiet min-h-9 px-3 text-sm" disabled={pending}
                    onClick={() => start(async () => { const r = await inviteCaredFor(p.id); if (r.error) setError(r.error); else setInvite({ who: p.label, url: `${origin}/join/${r.code}` }); })}>
                    Invite {p.label} to sign in
                  </button>
                )}
                <button type="button" className="btn-quiet min-h-9 px-3 text-sm" disabled={pending}
                  onClick={() => { if (confirm(`Stop planning for ${p.label}? Their recipes and plans are kept.`)) start(() => removeCaredFor(p.id)); }}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {acting && <button type="button" className="btn-secondary" disabled={pending} onClick={() => start(() => switchToMyFamily())}>← Back to my family</button>}

      {invite && (
        <div className="rounded-2xl bg-ochre-soft p-3 text-sm">
          <p className="font-bold">Send {invite.who} this link (it works once, for a week):</p>
          <p className="break-all">{invite.url}</p>
          <p className="text-muted">They make their own sign-in and see their plan and grocery list; you can still plan for them.</p>
        </div>
      )}

      <form action={(form) => start(async () => { setError(null); const r = await addCaredFor(form); if (r?.error) setError(r.error); })} className="flex flex-wrap gap-2">
        <label htmlFor="care-label" className="sr-only">Their name</label>
        <input id="care-label" name="label" className="field flex-1" placeholder="Their name, like Mom or Grandpa Joe" maxLength={40} required />
        <button className="btn-warm" disabled={pending}>{pending ? "Setting up…" : "+ Plan for them"}</button>
      </form>
      {error && <p role="alert" className="text-sm font-bold text-terracotta-dark">{error}</p>}
    </section>
  );
}
