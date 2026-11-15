"use client";

import { useState, useTransition } from "react";
import { joinHousehold } from "@/app/actions/household";

export function JoinButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => { const r = await joinHousehold(code); if (r?.error) setError(r.error); })}>
        {pending ? "Joining…" : "Yes, join"}
      </button>
      {error && <p className="font-semibold text-terracotta-dark">{error}</p>}
    </div>
  );
}
