"use client";

import { useState, useTransition } from "react";
import { updateParty } from "@/app/actions/party";

type Option = { key: string; name: string; icon: string; course: string; problems: string[]; shortcut: string | null };
type Initial = { kind: string; title: string; date: string; guests: number; meal: boolean; dishes: string[] };

/** Change the guest count, date, whether the food is the meal, and what's served. */
export function PartyEditor({ id, initial, options, courses }: { id: string; initial: Initial; options: Option[]; courses: { key: string; label: string }[] }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (key: string) => setV((s) => ({ ...s, dishes: s.dishes.includes(key) ? s.dishes.filter((d) => d !== key) : [...s.dishes, key] }));
  const changed = JSON.stringify(v) !== JSON.stringify(initial);
  return (
    <form
      className="no-print card space-y-4 p-5"
      aria-labelledby="edit-title"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await updateParty(id, v);
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Saved. The amounts and list are updated." });
        });
      }}
    >
      <h2 id="edit-title" className="text-2xl font-semibold">Change the plan</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="font-bold">Name</span>
          <input className="field mt-1 w-full" value={v.title} maxLength={60} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </label>
        <label className="block"><span className="font-bold">Date</span>
          <input type="date" className="field mt-1 w-full" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </label>
        <label className="block"><span className="font-bold">Guests</span>
          <input type="number" inputMode="numeric" min={4} max={150} className="field mt-1 w-full" value={v.guests} onChange={(e) => setV({ ...v, guests: Number(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" checked={v.meal} onChange={(e) => setV({ ...v, meal: e.target.checked })} />
          <span className="font-bold">The food is their meal (makes more)</span>
        </label>
      </div>
      {courses.map((c) => (
        <fieldset key={c.key}>
          <legend className="mb-1 font-bold text-muted">{c.label}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {options.filter((o) => o.course === c.key).map((o) => (
              <label key={o.key} className="flex items-start gap-2 rounded-xl bg-cream p-2">
                <input type="checkbox" className="mt-1" checked={v.dishes.includes(o.key)} onChange={() => toggle(o.key)} />
                <span>
                  <span className="font-semibold">{o.icon} {o.name}</span>
                  {o.problems.length > 0 && <span className="block text-sm font-bold text-terracotta-dark">⚠︎ {o.problems.join("; ")}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button className="btn-primary" disabled={pending || !changed}>{pending ? "Saving…" : "Save changes"}</button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-bold ${msg.ok ? "text-olive-dark" : "text-terracotta-dark"}`}>{msg.text}</p>}
    </form>
  );
}
