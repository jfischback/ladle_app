"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { fridgePhoto } from "@/app/actions/fridge";

/** Snap the fridge: the AI lists what it sees, and "Use what I have" finds dinners for it. */
export function FridgeButton({ tab, typed }: { tab: string; typed: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const read = (file: File) =>
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("photo", file);
      const r = await fridgePhoto(form);
      if (r.error || !r.items) return setError(r.error ?? "Something went wrong. Try again.");
      const have = [typed, ...r.items].map((x) => x.trim()).filter(Boolean).join(", ").slice(0, 300);
      const p = new URLSearchParams({ f: "have", have });
      if (tab !== "mine") p.set("tab", tab);
      router.push(`/recipes?${p.toString()}`);
    });
  return (
    <div className="space-y-1">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Photo of your fridge" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
      <button type="button" className="btn-secondary min-h-10 px-4 text-sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? "Looking in your fridge…" : "📷 Snap my fridge"}
      </button>
      {error && <p role="alert" className="text-sm font-bold text-terracotta-dark">{error}</p>}
    </div>
  );
}
