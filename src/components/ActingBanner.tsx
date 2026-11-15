"use client";

import { useTransition } from "react";
import { switchToMyFamily } from "@/app/actions/care";

/** Caregiver mode: a bar on every page while planning for someone else, so it's never a surprise. */
export function ActingBanner({ label }: { label: string }) {
  const [pending, start] = useTransition();
  return (
    <div role="status" className="no-print sticky top-[3.9rem] z-20 border-b border-olive/30 bg-olive text-cream">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="font-bold">🤝 Planning for {label}</p>
        <button type="button" className="rounded-full bg-cream/15 px-3 py-1 font-bold hover:bg-cream/25" disabled={pending} onClick={() => start(() => switchToMyFamily())}>
          {pending ? "Switching…" : "Back to my family"}
        </button>
      </div>
    </div>
  );
}
