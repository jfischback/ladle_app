import { markSeen } from "@/lib/seen";
import Link from "next/link";
import { requireUserId } from "@/auth";
import { browseStarters, getSettings, myPantry, myRecipes } from "@/lib/data";
import { parseOnHand, rankByOnHand, type OnHandMatch } from "@/lib/on-hand";
import { ruleProblems } from "@/lib/diet";
import { addAllStarters, addStarter } from "@/app/actions/recipes";
import { Stars } from "@/components/Stars";
import type { Recipe } from "@/db/schema";
import { formatMinutes } from "@/lib/format";
import { FoodArt } from "@/components/FoodArt";
import { CooksTab } from "./CooksTab";
import { FridgeButton } from "./FridgeButton";
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

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; f?: string; have?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const t = sp.tab;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const filter = FILTERS.find((x) => x.key === sp.f) ?? null;
  // "Use what I have": what they typed plus what the Pantry page says is on hand.
  const haveMode = sp.f === "have";
  const typedHave = (sp.have ?? "").slice(0, 300);
  const tab = t === "browse" ? "browse" : t === "cooks" ? "cooks" : t === "lunch" ? "lunch" : t === "breakfast" ? "breakfast" : t === "dessert" ? "dessert" : "mine";
  // Getting started: they've looked at this.
  if (tab === "cooks") await markSeen(userId, "creators");
  const [mine, lunches, breakfasts, desserts, browse, { data: settings }] = await Promise.all([myRecipes(userId), myRecipes(userId, "lunch"), myRecipes(userId, "breakfast"), myRecipes(userId, "dessert"), browseStarters(userId), getSettings(userId)]);
  // How many starters are in each recipe pack.
  const db = await getDb();
  const starterTags = await db.select({ tags: recipesTable.tags }).from(recipesTable).where(and(isNull(recipesTable.ownerId), isNull(recipesTable.archivedAt)));
  const packCounts: Record<string, number> = {};
  for (const r of starterTags) for (const t of r.tags) packCounts[t] = (packCounts[t] ?? 0) + 1;
  const problemsOf = (r: Recipe) => ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway);
  const all = tab === "mine" ? mine : tab === "lunch" ? lunches : tab === "breakfast" ? breakfasts : tab === "dessert" ? desserts : browse;
  // Search by name, protein or ingredient; then the chosen filter chip.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = all.filter((r) => {
    if (filter && !filter.keep(r)) return false;
    if (!words.length) return true;
    const text = [r.name, r.protein ?? "", ...r.ingredients.map((i) => i.item)].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
  const pantryOnHand = haveMode ? (await myPantry(userId)).filter((p) => p.status !== "out").map((p) => p.name) : [];
  const onHand = [...parseOnHand(typedHave), ...pantryOnHand];
  const ranked = haveMode ? rankByOnHand(list, parseOnHand(typedHave), pantryOnHand) : [];
  const matchOf = new Map<string, OnHandMatch>(ranked.map((x) => [x.r.id, x.m]));
  const shown = haveMode ? ranked.map((x) => x.r) : list;
  const linkWith = (patch: { f?: string | null; q?: string | null }) => {
    const p = new URLSearchParams();
    if (tab !== "mine") p.set("tab", tab);
    const nq = patch.q === undefined ? q : patch.q;
    const nf = patch.f === undefined ? filter?.key : patch.f;
    if (nq) p.set("q", nq);
    if (nf) p.set("f", nf);
    if (nf === "have" && typedHave) p.set("have", typedHave);
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

      <div role="tablist" className="mb-5 flex max-w-full flex-wrap gap-1 rounded-3xl bg-oat p-1 sm:inline-flex">
        <Tab href="/recipes" active={tab === "mine"}>Dinners ({mine.length})</Tab>
        <Tab href="/recipes?tab=breakfast" active={tab === "breakfast"}>Breakfasts ({breakfasts.length})</Tab>
        <Tab href="/recipes?tab=lunch" active={tab === "lunch"}>Lunches ({lunches.length})</Tab>
        <Tab href="/recipes?tab=dessert" active={tab === "dessert"}>Desserts ({desserts.length})</Tab>
        <Tab href="/recipes?tab=cooks" active={tab === "cooks"}>✨ Food creators</Tab>
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
            {(filter || haveMode) && <input type="hidden" name="f" value={haveMode ? "have" : filter!.key} />}
            {haveMode && typedHave && <input type="hidden" name="have" value={typedHave} />}
            <input name="q" defaultValue={q} placeholder="Search: chicken, tacos, rice…" aria-label="Search recipes" className="field" />
            <button className="btn-secondary shrink-0">Search</button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            <Link href={linkWith({ f: haveMode ? null : "have" })} aria-current={haveMode ? "true" : undefined} className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${haveMode ? "border-terracotta bg-terracotta text-cream" : "border-terracotta/40 bg-card text-terracotta-dark hover:border-terracotta"}`}>
              🥫 Use what I have
            </Link>
            {FILTERS.filter((x) => all.some(x.keep)).map((x) => {
              const on = filter?.key === x.key;
              return (
                <Link key={x.key} href={linkWith({ f: on ? null : x.key })} aria-current={on ? "true" : undefined} className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${on ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink hover:border-olive/50"}`}>
                  {x.label}
                </Link>
              );
            })}
          </div>
          {haveMode && (
            <form action="/recipes" className="card space-y-2 p-4">
              {tab !== "mine" && <input type="hidden" name="tab" value={tab} />}
              <input type="hidden" name="f" value="have" />
              {q && <input type="hidden" name="q" value={q} />}
              <label htmlFor="have" className="font-bold">What do you have to use up?</label>
              <div className="flex gap-2">
                <input id="have" name="have" defaultValue={typedHave} placeholder="chicken, rice, broccoli…" className="field" />
                <button className="btn-primary shrink-0">Find dinners</button>
              </div>
              <p className="text-sm text-muted">
                {pantryOnHand.length > 0 ? <>Also counting the {pantryOnHand.length} things on hand in your <Link href="/pantry" className="font-bold text-olive-dark underline">Pantry</Link>. </> : <>Tip: things you mark in your <Link href="/pantry" className="font-bold text-olive-dark underline">Pantry</Link> count too. </>}
                Dinners that use up the most come first.
              </p>
              <FridgeButton tab={tab} typed={typedHave} />
            </form>
          )}
          {haveMode && onHand.length === 0 && !q ? (
            // Nothing to match yet: say what to do, not "0 recipes".
            <p className="text-sm text-muted">Type what you have, or snap your fridge, and the dinners that use it show up here. <Link href={linkWith({ f: null, q: null })} className="font-bold text-olive-dark underline">Back to all recipes</Link></p>
          ) : (q || filter || haveMode) && (
            <p className="text-sm text-muted">
              {shown.length} of {all.length} recipes{q ? ` matching “${q}”` : ""}{filter ? ` · ${filter.label.replace(/^\S+ /, "")}` : ""}{haveMode ? " · use what I have" : ""} ·{" "}
              <Link href={linkWith({ f: null, q: null })} className="font-bold text-olive-dark underline">Clear</Link>
            </p>
          )}
        </div>
      )}

      {tab === "cooks" ? null : haveMode && onHand.length === 0 ? null : shown.length === 0 && (q || filter || haveMode) ? (
        <div className="card p-8 text-center">
          <p className="font-display text-2xl font-semibold">Nothing matches</p>
          <p className="mt-1 text-muted">{haveMode ? "None of these recipes use what you listed. " : ""}Try another word, or <Link href={linkWith({ f: null, q: null })} className="font-bold text-olive-dark underline">clear the search</Link>.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <FoodArt kind={tab === "mine" ? "pot" : "nightoff"} className="h-24 w-24" rounded="rounded-full" />
          {tab === "mine" || tab === "lunch" || tab === "breakfast" || tab === "dessert" ? (
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
          {shown.map((r) => (
            <li key={r.id}>
              <RecipeCard r={r} browse={tab === "browse"} problems={problemsOf(r)} match={matchOf.get(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link role="tab" aria-selected={active} href={href} className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold sm:px-4 sm:text-base transition-colors ${active ? "bg-card text-terracotta-dark shadow-soft" : "text-olive-dark hover:text-ink"}`}>
      {children}
    </Link>
  );
}

function RecipeCard({ r, browse, problems, match }: { r: Recipe; browse: boolean; problems: string[]; match?: OnHandMatch }) {
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
        {match && (
          <p className="text-xs leading-snug">
            {match.need.length === 0 ? (
              <b className="text-olive-dark">✓ You have everything</b>
            ) : (
              <>
                <b className="text-olive-dark">Have {match.have} of {match.total}</b>
                <span className="text-muted"> · need {match.need.slice(0, 3).join(", ")}{match.need.length > 3 ? ` +${match.need.length - 3} more` : ""}</span>
              </>
            )}
          </p>
        )}
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
