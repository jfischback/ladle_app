"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reuseWeek } from "@/app/actions/plans";

export function ReuseButton({ planId }: { planId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="text-right">
      <button
        className="btn-quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reuseWeek(planId);
            if (r?.error) setError(r.error);
            else router.push("/");
          })
        }
      >
        {pending ? "Copying…" : "Reuse this week"}
      </button>
      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
    </div>
  );
}
