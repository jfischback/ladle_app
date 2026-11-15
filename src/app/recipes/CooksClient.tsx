"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkCooks, dismissFound, followCook, followSuggested, saveFound, unfollowCook } from "@/app/actions/cooks";

function foundNote(n: number | undefined, remaining = 0) {
  if (n == null) return null;
  const base = n ? `Found ${n} new dinner${n === 1 ? "" : "s"}!` : remaining ? "" : "No new dinners right now. We'll keep checking.";
  const more = remaining ? ` Still checking ${remaining} more cook${remaining === 1 ? "" : "s"}; tap "Check for new recipes" in a minute.` : "";
  return (base + more).trim();
}

export function FollowForm() {
  const [site, setSite] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          const r = await followCook(site);
          if (r?.error) setMsg({ ok: false, text: r.error });
          else {
            setSite("");
            setMsg({ ok: true, text: `Following! ${foundNote(r?.found, r?.remaining) ?? ""}` });
          }
        });
      }}
    >
      <label htmlFor="cook-site" className="label">Follow another cook</label>
      <div className="flex gap-2">
        <input id="cook-site" className="field" inputMode="url" autoComplete="url" placeholder="Their website, like pinchofyum.com" value={site} onChange={(e) => setSite(e.target.value)} disabled={pending} />
        <button className="btn-primary shrink-0" disabled={pending || !site.trim()}>{pending ? "Looking…" : "Follow"}</button>
      </div>
      {pending && <p className="text-sm text-muted">Finding their recipes. This can take up to half a minute the first time.</p>}
      {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-olive-dark" : "text-terracotta-dark"}`}>{msg.text}</p>}
      <p className="text-xs text-muted">Works with most food blogs. Instagram and TikTok can&apos;t be followed; save those with &quot;+ Add your own&quot; using the post&apos;s link or a screenshot.</p>
    </form>
  );
}

export function SuggestedCooks({ names, first }: { names: string[]; first: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? names : names.slice(0, 12);
  if (!names.length) return msg ? <p role="status" className="rounded-3xl bg-olive-soft p-4 font-semibold text-olive-dark">{msg}</p> : null;
  const follow = (list: string[], label: string) =>
    start(async () => {
      setBusy(label);
      setMsg(null);
      const r = await followSuggested(list);
      setMsg(foundNote(r?.found, r?.remaining));
      setBusy(null);
    });
  return (
    <section className={`rounded-3xl p-5 shadow-soft ${first ? "bg-blush" : "bg-oat"}`} aria-labelledby="suggest-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="suggest-title" className="text-xl font-semibold">{first ? "Start with these favorites" : "More cooks you might like"}</h2>
        {names.length > 1 && (
          <button className="btn-warm min-h-10 px-4 text-sm" disabled={pending} onClick={() => follow(names, "all")}>
            {busy === "all" ? "Following…" : `Follow all ${names.length}`}
          </button>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {shown.map((n) => (
          <li key={n}>
            <button className="btn-secondary min-h-10 px-3 text-sm" disabled={pending} onClick={() => follow([n], n)}>
              {busy === n ? "…" : "+"} {n}
            </button>
          </li>
        ))}
        {names.length > shown.length && (
          <li>
            <button className="btn-quiet min-h-10 px-3 text-sm" onClick={() => setShowAll(true)}>Show all {names.length} ▾</button>
          </li>
        )}
      </ul>
      {pending && <p className="mt-2 text-sm text-muted">Finding their newest dinners. This can take up to half a minute.</p>}
      {msg && <p role="status" className="mt-2 text-sm font-semibold text-olive-dark">{msg}</p>}
    </section>
  );
}

export function CheckButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button className="btn-secondary min-h-10 px-4 text-sm" disabled={pending} onClick={() => start(async () => { setMsg(null); const r = await checkCooks(); setMsg(r?.error ?? foundNote(r?.found, r?.remaining)); })}>
        {pending ? "Checking…" : "↻ Check for new recipes"}
      </button>
      {msg && <p role="status" className="mt-1 text-sm font-semibold text-olive-dark">{msg}</p>}
    </div>
  );
}

export function UnfollowButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={`Stop following ${name}`}
      title="Stop following"
      disabled={pending}
      className="flex h-7 w-7 items-center justify-center rounded-full text-olive-dark hover:bg-card"
      onClick={() => { if (confirm(`Stop following ${name}?`)) start(() => unfollowCook(id)); }}
    >
      ×
    </button>
  );
}

export function ShelfActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="mt-auto pt-1">
      <div className="flex gap-1.5">
        <button
          className="btn-primary min-h-9 flex-1 px-2 text-sm"
          disabled={pending}
          onClick={() => start(async () => {
            setError(null);
            const r = await saveFound(id);
            if (r.error) setError(r.error);
            else if (r.recipeId) router.push(`/recipes/${r.recipeId}`);
          })}
        >
          {pending ? "Saving…" : "+ Save"}
        </button>
        <button className="btn-quiet min-h-9 px-2 text-xs" disabled={pending} onClick={() => start(() => dismissFound(id))}>Not for us</button>
      </div>
      {error && <p className="mt-1 text-xs text-terracotta-dark">{error}</p>}
    </div>
  );
}
