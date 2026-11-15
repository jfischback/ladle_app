import Link from "next/link";

/**
 * Ladle's two stand-out features, front and center: recipes from the family's favorite food creators, and
 * athlete mode. `only` shows just the ones not set up yet (so Home doesn't nag once they're in use).
 */
export function FeatureCards({ creators, athletes, only = "all", title, compact = false }: { creators: string[]; athletes: number; only?: "all" | "unused"; title?: string; compact?: boolean }) {
  if (compact) return <CompactCards creators={creators} athletes={athletes} only={only} />;
  const showCreators = only === "all" || creators.length === 0;
  const showAthletes = only === "all" || athletes === 0;
  if (!showCreators && !showAthletes) return null;
  return (
    <section aria-label={title ?? "Make Ladle yours"} className="no-print space-y-2">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <div className={`grid gap-3 ${showCreators && showAthletes ? "sm:grid-cols-2" : ""}`}>
        {showCreators && (
          <Link href="/recipes?tab=cooks" className="card group flex flex-col gap-2 border-2 border-ochre/50 bg-ochre-soft/60 p-4 transition-shadow hover:shadow-lift">
            <span className="flex items-center gap-2 text-lg font-bold">
              <span className="text-2xl" aria-hidden="true">✨</span> Recipes from your favorite food creators
            </span>
            <span className="text-muted">
              {creators.length
                ? `Following ${creators.slice(0, 3).join(", ")}${creators.length > 3 ? ` and ${creators.length - 3} more` : ""}. Their newest dinners show up in your week, especially when the ingredients are on sale.`
                : "Follow the food bloggers and creators you love (Half Baked Harvest, RecipeTin Eats, Pinch of Yum…). Their newest dinners show up in your week, especially when the ingredients are on sale."}
            </span>
            <span className="mt-auto font-bold text-terracotta-dark group-hover:underline">{creators.length ? "See what's new →" : "Pick your favorites →"}</span>
          </Link>
        )}
        {showAthletes && (
          <Link href="/athletes" className="card group flex flex-col gap-2 border-2 border-olive/40 bg-olive-soft/60 p-4 transition-shadow hover:shadow-lift">
            <span className="flex items-center gap-2 text-lg font-bold">
              <span className="text-2xl" aria-hidden="true">💪</span> Athlete mode
            </span>
            <span className="text-muted">
              {athletes
                ? `${athletes} ${athletes === 1 ? "person is" : "people are"} set up. Portions, protein and snacks follow their training.`
                : "CrossFit, strongman, lifting, running or just getting fit? Bigger portions, more protein and the right snacks for whoever's training, while the rest of the family eats as usual."}
            </span>
            <span className="mt-auto font-bold text-olive-dark group-hover:underline">{athletes ? "Edit athletes →" : "Set up athlete mode →"}</span>
          </Link>
        )}
      </div>
    </section>
  );
}

/** One slim row per feature, for Home, where the week comes first. */
function CompactCards({ creators, athletes, only }: { creators: string[]; athletes: number; only: "all" | "unused" }) {
  const rows = [
    ...(only === "all" || creators.length === 0 ? [{ href: "/recipes?tab=cooks", icon: "✨", title: "Get recipes from your favorite food creators", cls: "border-ochre/50 bg-ochre-soft/60" }] : []),
    ...(only === "all" || athletes === 0 ? [{ href: "/athletes", icon: "💪", title: "Athlete mode: portions and protein for whoever's training", cls: "border-olive/40 bg-olive-soft/60" }] : []),
  ];
  if (!rows.length) return null;
  return (
    <ul className="no-print grid gap-2">
      {rows.map((r) => (
        <li key={r.href}>
          <Link href={r.href} className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 font-bold hover:shadow-soft ${r.cls}`}>
            <span className="text-xl" aria-hidden="true">{r.icon}</span>
            <span className="min-w-0 flex-1">{r.title}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
