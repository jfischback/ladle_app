import Link from "next/link";
import { requireUserId } from "@/auth";
import { browseStarters, myRecipes } from "@/lib/data";
import { addAllStarters, addStarter } from "@/app/actions/recipes";
import { Stars } from "@/components/Stars";
import type { Recipe } from "@/db/schema";
import { formatMinutes } from "@/lib/format";
import { FoodArt } from "@/components/FoodArt";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const userId = await requireUserId();
  const tab = (await searchParams).tab === "browse" ? "browse" : "mine";
  const [mine, browse] = await Promise.all([myRecipes(userId), browseStarters(userId)]);
  const list = tab === "mine" ? mine : browse;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Your recipe box</p>
          <h1 className="text-4xl font-semibold">Recipes</h1>
        </div>
        <Link href="/recipes/new" className="btn-warm">+ Add your own</Link>
      </div>

      <div role="tablist" className="mb-5 inline-flex gap-1 rounded-full bg-oat p-1">
        <Tab href="/recipes" active={tab === "mine"}>My Recipes ({mine.length})</Tab>
        <Tab href="/recipes?tab=browse" active={tab === "browse"}>Browse ({browse.length})</Tab>
      </div>

      {tab === "browse" && browse.length > 0 && (
        <form action={addAllStarters} className="mb-4">
          <button className="btn-secondary">+ Add all {browse.length} to My Recipes</button>
        </form>
      )}

      {list.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <FoodArt kind={tab === "mine" ? "pot" : "nightoff"} className="h-24 w-24" rounded="rounded-full" />
          {tab === "mine" ? (
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
              <RecipeCard r={r} browse={tab === "browse"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link role="tab" aria-selected={active} href={href} className={`rounded-full px-4 py-2 font-bold transition-colors ${active ? "bg-card text-terracotta-dark shadow-soft" : "text-olive-dark hover:text-ink"}`}>
      {children}
    </Link>
  );
}

function RecipeCard({ r, browse }: { r: Recipe; browse: boolean }) {
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
