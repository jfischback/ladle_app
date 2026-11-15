"use client";

import { FoodArt } from "@/components/FoodArt";

/** Shown when a page fails to load, instead of the bare "Application error" screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
      <FoodArt kind="soup" className="h-24 w-24" rounded="rounded-full" />
      <h1 className="text-3xl font-semibold">Oops, something boiled over</h1>
      <p className="text-lg text-muted">This page didn&apos;t load. Try again in a moment.</p>
      <button className="btn-warm" onClick={reset}>Try again</button>
      {error.digest && <p className="text-xs text-muted">Error code {error.digest} (find it in Vercel → Logs)</p>}
    </div>
  );
}
