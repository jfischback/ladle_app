"use client";

import { useState, useTransition } from "react";
import { setRecipeNotes } from "@/app/actions/recipes";

/** "Our notes": the family's own tweaks to a recipe, kept with it and shown in cooking mode. */
export function RecipeNotes({ id, notes }: { id: string; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const r = await setRecipeNotes(id, text);
      if (r?.error) setError(r.error);
      else setEditing(false);
    });

  if (!editing) {
    return notes ? (
      <section className="rounded-3xl bg-ochre-soft p-4 shadow-soft" aria-label="Our notes">
        <div className="flex items-start justify-between gap-3">
          <p className="font-bold">📝 Our notes</p>
          <button type="button" className="btn-quiet min-h-9 px-3 text-sm" onClick={() => setEditing(true)}>Edit</button>
        </div>
        <p className="mt-1 whitespace-pre-line">{notes}</p>
      </section>
    ) : (
      <button type="button" className="btn-quiet w-full justify-start sm:w-auto" onClick={() => setEditing(true)}>📝 Add your own notes (like &ldquo;half the chili powder for the kids&rdquo;)</button>
    );
  }
  return (
    <section className="card space-y-2 p-4" aria-label="Our notes">
      <label htmlFor="family-notes" className="font-bold">📝 Our notes</label>
      <textarea
        id="family-notes"
        className="field min-h-28"
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        placeholder="What you change, what the kids like, what to serve it with…"
        autoFocus
      />
      <p className="text-xs text-muted">Only your household sees these. They show up in cooking mode too.</p>
      {error && <p role="alert" className="text-sm font-bold text-terracotta-dark">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save notes"}</button>
        <button type="button" className="btn-quiet" disabled={pending} onClick={() => { setText(notes ?? ""); setEditing(false); setError(null); }}>Cancel</button>
      </div>
    </section>
  );
}
