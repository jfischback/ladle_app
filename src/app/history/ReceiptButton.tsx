"use client";

import { useRef, useState, useTransition } from "react";
import { readReceiptTotal } from "@/app/actions/plans";

const usd = (n: number) => "$" + n.toFixed(2);

/** Snap the receipt instead of typing the total. */
export function ReceiptButton({ planId }: { planId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const read = (file: File) =>
    start(async () => {
      setNote(null);
      const form = new FormData();
      form.set("photo", file);
      const r = await readReceiptTotal(planId, form);
      if (r.error || r.total == null) setNote({ ok: false, text: r.error ?? "Something went wrong. Try again." });
      else setNote({ ok: true, text: `Saved ${usd(r.total)}${r.saved ? ` (the receipt says you saved ${usd(r.saved)})` : ""}. Check it matches.` });
    });
  return (
    <div className="space-y-1">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Photo of the receipt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) read(f);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn-quiet min-h-11 px-3 text-sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? "Reading the receipt…" : "📷 Read my receipt"}
      </button>
      {note && <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "text-olive-dark" : "font-bold text-terracotta-dark"}`}>{note.text}</p>}
    </div>
  );
}
