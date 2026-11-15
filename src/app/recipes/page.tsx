import Link from "next/link";
import { requireUserId } from "@/auth";
import { browseStarters, getSettings, myRecipes } from "@/lib/data";
import { ruleProblems } from "@/lib/diet";
import { addAllStarters, addStarter } from "@/app/actions/recipes";
import { Stars } from "@/components/Stars";
import type { Recipe } from "@/db/schema";
import { formatMinutes } from "@/lib/format";
import { FoodArt } from "@/components/FoodArt";
import { CooksTab } from "./CooksTab";
import { RecipePacks } from "./RecipePacks";
import { getDb } from "@/db";
import { recipes as recipesTable } from "@/db/schema";
import { and, isNull } from "drizzle-orm";

// Planning, approving and importing can take a while (the AI, store prices): give them a minute.
export const maxDuration = 60;

// Filter chips: what each one keeps.
const FILTERS: { key: string; label: string; keep: (r: Recipe) => boolean }[] = [
  { key: "quick", label: "⏱ 30 min or less", keep: (r) => (r.totalMinutes != null && r.totalMinutes <= 30) || r.tags.includes("quick") },
  { key: "favorites", label: "⭐ Favorites", keep: (r) => (r.rating ?? 0) >= 4 },
  { key: "budget", label: "💵 Budget", keep: (r) => r.tags.includes("budget") },
  { key: "kid-friendly", label: "🧒 Kid favorites", keep: (r) => r.tags.includes("kid-friendly") },
  { key: "vegetarian", label: "🥦 Vegetarian", keep: (r) => r.tags.includes("vegetarian") },
  { key: "low-carb", label: "🥑 Low-carb", keep: (r) => r.tags.includes("low-carb") },
  { key: "freezer", label: "🧊 Freezer", keep: (r) => r.tags.includes("freezer") || r.tags.includes("make-ahead") },
  { key: "slow-cooker", label: "🥘 Slow cooker", keep: (r) => r.tags.includes("slow-cooker") },
];

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; f?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const t = sp.tab;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const filter = FILTERS.find((x) => x.key === sp.f) ?? null;
  const tab = t === "browse" ? "browse" : t === "cooks" ? "cooks" : t === "lunch" ? "lunch" : t === "breakfast" ? "breakfast" : "mine";
  const [mine, lunches, breakfasts, browse, { data: settings }] = await Promise.all([myRecipes(userId), myRecipes(userId, "lunch"), myRecipes(userId, "breakfast"), browseStarters(userId), getSettings(userId)]);
  // How many starters are in each recipe pack.
  const db = await getDb();
  const starterTags = await db.select({ tags: recipesTable.tags }).from(recipesTable).where(and(isNull(recipesTable.ownerId), isNull(recipesTable.archivedAt)));
  const packCounts: Record<string, number> = {};
  for (const r of starterTags) for (const t of r.tags) packCounts[t] = (packCounts[t] ?? 0) + 1;
  const problemsOf = (r: Recipe) => ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway);
  const all = tab === "mine" ? mine : tab === "lunch" ? lunches : tab === "breakfast" ? breakfasts : browse;
  // Search by name, protein or ingredient; then the chosen filter chip.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = all.filter((r) => {
    if (filter && !filter.keep(r)) return false;
    if (!words.length) return true;
    const text = [r.name, r.protein ?? "", ...r.ingredients.map((i) => i.item)].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
  const linkWith = (patch: { f?: string | null; q?: string | null }) => {
    const p = new URLSearchParams();
    if (tab !== "mine") p.set("tab", tab);
    const nq = patch.q === undefined ? q : patch.q;
    const nf = patch.f === undefined ? filter?.key : patch.f;
    if (nq) p.set("q", nq);
    if (nf) p.set("f", nf);
    const s = p.toString();
    return `/recipes${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Your recipe box</p>
          <h1 className="text-4xl font-semibold">Recipes</h1>
        </div>
        <Link href="/recipes/new" className="btn-warm">+ Add your own</Link>
      </div>

      <div role="tablist" className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-oat p-1">
        <Tab href="/recipes" active={tab === "mine"}>Dinners ({mine.length})</Tab>
        <Tab href="/recipes?tab=breakfast" active={tab === "breakfast"}>Breakfasts ({breakfasts.length})</Tab>
        <Tab href="/recipes?tab=lunch" active={tab === "lunch"}>Lunches ({lunches.length})</Tab>
        <Tab href="/recipes?tab=cooks" active={tab === "cooks"}>✨ Your cooks</Tab>
        <Tab href="/recipes?tab=browse" active={tab === "browse"}>Starters &amp; packs</Tab>
      </div>

      {tab === "cooks" && <CooksTab userId={userId} />}

      {tab === "browse" && <RecipePacks counts={packCounts} />}

      {tab === "browse" && browse.length > 0 && (
        <form action={addAllStarters} className="mb-4">
          <button className="btn-secondary">+ Add all {browse.length} to My Recipes</button>
        </form>
      )}

      {tab !== "cooks" && all.length > 6 && (
        <div className="mb-4 space-y-2">
          <form action="/recipes" className="flex gap-2" role="search">
            {tab !== "mine" && <input type="hidden" name="tab" value={tab} />}
            {filter && <input type="hidden" name="f" value={filter.key} />}
            <input name="q" defaultValue={q} placeholder="Search: chicken, tacos, rice…" aria-label="Search recipes" className="field" />
            <button className="btn-secondary shrink-0">Search</button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.filter((x) => all.some(x.keep)).map((x) => {
              const on = filter?.key === x.key;
              return (
                <Link key={x.key} href={linkWith({ f: on ? null : x.key })} aria-pressed={on} className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${on ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink hover:border-olive/50"}`}>
                  {x.label}
                </Link>
              );
            })}
          </div>
          {(q || filter) && (
            <p className="text-sm text-muted">
              {list.length} of {all.length} recipes{q ? ` matching “${q}”` : ""}{filter ? ` · ${filter.label.replace(/^\S+ /, "")}` : ""} ·{" "}
              <Link href={linkWith({ f: null, q: null })} className="font-bold text-olive-dark underline">Clear</Link>
            </p>
          )}
        </div>
      )}

      {tab === "cooks" ? null : list.length === 0 && (q || filter) ? (
        <div className="card p-8 text-center">
          <p className="font-display text-2xl font-semibold">Nothing matches</p>
          <p className="mt-1 text-muted">Try another word, or <Link href={linkWith({ f: null, q: null })} className="font-bold text-olive-dark underline">clear the search</Link>.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <FoodArt kind={tab === "mine" ? "pot" : "nightoff"} className="h-24 w-24" rounded="rounded-full" />
          {tab === "mine" || tab === "lunch" || tab === "breakfast" ? (
            <>
              <p className="font-display text-2xl font-semibold">Your recipe box is empty</p>
              <p className="text-lg text-muted">Start with our family favorites, or add the dinners you already love.</p>
              <Link className="btn-primary" href="/recipes?tab=browse">Browse our favorites</Link>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-semibold">You&apos;ve got them all!</p>
              <p className="text-lg text-muted">Every recipe from our starter set is already in your box.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((r) => (
            <li key={r.id}>
              <RecipeCard r={r} browse={tab === "browse"} problems={problemsOf(r)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link role="tab" aria-selected={active} href={href} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-bold transition-colors ${active ? "bg-card text-terracotta-dark shadow-soft" : "text-olive-dark hover:text-ink"}`}>
      {children}
    </Link>
  );
}

function RecipeCard({ r, browse, problems }: { r: Recipe; browse: boolean; problems: string[] }) {
  return (
    <div className="card group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <FoodArt name={r.name} protein={r.protein} className="h-24 w-full sm:h-28" rounded="rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Link href={`/recipes/${r.id}`} className="font-bold leading-snug after:absolute after:inset-0 group-hover:underline">
          {r.name}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {r.totalMinutes && <span className="tag">⏱ {formatMinutes(r.totalMinutes)}</span>}
          {r.prepAhead && <span className="tag bg-ochre-soft text-ochre-dark">Prep ahead</span>}
          {problems.length > 0 && (
            <span className="tag bg-terracotta-soft font-bold text-terracotta-dark" title={`${problems.join(", ")}. It won't be planned.`}>
              ⚠︎ {problems[0].replace(/ \(.*\)$/, "")}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between pt-1">
          {browse ? (
            <span className="text-xs text-muted">{r.ingredients.length} items</span>
          ) : (
            <Stars value={r.rating} size="text-base" />
          )}
          {browse && (
            <form action={addStarter.bind(null, r.id)} className="relative z-10">
              <button className="btn-primary min-h-9 px-3 text-sm">+ Add</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
