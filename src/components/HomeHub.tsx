import Link from "next/link";
import { HideGettingStarted } from "./HideGettingStarted";

type Tile = { href: string; icon: string; title: string; sub: string; tone?: "warm" | "olive" | "ochre" | "plain" };

/** The home hub: one big tile for each place in Ladle, so everything starts from here. */
export function HomeHub({ tiles }: { tiles: Tile[] }) {
  const tone = {
    warm: "bg-terracotta text-cream border-terracotta",
    olive: "bg-olive-soft border-olive/30",
    ochre: "bg-ochre-soft border-ochre/40",
    plain: "bg-card border-line",
  } as const;
  return (
    <nav aria-label="Ladle" className="no-print grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tiles.map((t) => (
        <Link key={t.title} href={t.href} className={`flex min-h-24 flex-col justify-between gap-1 rounded-3xl border-2 p-3.5 shadow-soft transition-shadow hover:shadow-lift ${tone[t.tone ?? "plain"]}`}>
          <span className="text-2xl" aria-hidden="true">{t.icon}</span>
          <span>
            <span className="block font-bold leading-tight">{t.title}</span>
            <span className={`block text-sm leading-snug ${t.tone === "warm" ? "text-cream" : "text-muted"}`}>{t.sub}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

type Step = { href: string; title: string; why: string; done: boolean };

/** A short "Getting started" list for new families: each step links where it happens and ticks itself off. */
export function GettingStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-labelledby="getting-started" className="no-print card space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="getting-started" className="text-xl font-semibold">Getting started</h2>
        <span className="text-sm font-bold text-olive-dark">{done} of {steps.length} done</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-oat" aria-hidden="true">
        <div className="h-full rounded-full bg-olive" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.title}>
            <Link href={s.href} className={`flex items-start gap-3 rounded-2xl p-2 hover:bg-cream ${s.done ? "text-muted" : ""}`}>
              <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${s.done ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>{s.done ? "✓" : ""}</span>
              <span className="min-w-0">
                <span className={`block font-bold ${s.done ? "line-through" : ""}`}>{s.title}</span>
                {!s.done && <span className="block text-sm text-muted">{s.why}</span>}
              </span>
              <span className="sr-only">{s.done ? "(done)" : ""}</span>
            </Link>
          </li>
        ))}
      </ol>
      <HideGettingStarted />
    </section>
  );
}
