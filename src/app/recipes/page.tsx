import Link from "next/link";
import { requireUserId } from "@/auth";
import { browseStarters, myRecipes } from "@/lib/data";
import { addAllStarters, addStarter } from "@/app/actions/recipes";
import { Stars } from "@/components/Stars";
import type { Recipe } from "@/db/schema";
import { formatMinutes } from "@/lib/format";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const userId = await requireUserId();
  const tab = (await searchParams).tab === "browse" ? "browse" : "mine";
  const [mine, browse] = await Promise.all([myRecipes(userId), browseStarters(userId)]);
  const list = tab === "mine" ? mine : browse;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Recipes</h1>
        <Link href="/recipes/new" className="btn-primary">Add your own</Link>
      </div>

      <div role="tablist" className="mb-5 flex gap-2">
        <Tab href="/recipes" active={tab === "mine"}>My Recipes ({mine.length})</Tab>
        <Tab href="/recipes?tab=browse" active={tab === "browse"}>Browse ({browse.length})</Tab>
      </div>

      {tab === "browse" && browse.length > 0 && (
        <form action={addAllStarters} className="mb-4">
          <button className="btn-secondary">Add all {browse.length} to My Recipes</button>
        </form>
      )}

      {list.length === 0 ? (
        <div className="card p-6 text-center text-lg text-muted">
          {tab === "mine" ? (
            <>No recipes in rotation yet. <Link className="font-semibold text-olive-dark underline" href="/recipes?tab=browse">Browse ours</Link> or add your own.</>
          ) : (
            "You've added every recipe from our starter set."
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
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
    <Link role="tab" aria-selected={active} href={href} className={`rounded-full px-4 py-2 font-semibold ${active ? "bg-olive text-cream" : "bg-oat text-olive-dark hover:bg-olive-soft"}`}>
      {children}
    </Link>
  );
}

function RecipeCard({ r, browse }: { r: Recipe; browse: boolean }) {
  return (
    <div className="card flex h-full flex-col gap-2 p-4">
      <Link href={`/recipes/${r.id}`} className="text-lg font-bold leading-snug hover:underline">
        {r.name}
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {r.protein && <span className="tag">{r.protein}</span>}
        {r.totalMinutes && <span className="tag">{formatMinutes(r.totalMinutes)}</span>}
        {r.prepAhead && <span className="tag">Prep ahead</span>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        {browse ? (
          <span className="text-sm text-muted">{r.ingredients.length} ingredients</span>
        ) : (
          <Stars value={r.rating} size="text-base" />
        )}
        {browse && (
          <form action={addStarter.bind(null, r.id)}>
            <button className="btn-secondary min-h-10 px-4 text-sm">Add</button>
          </form>
        )}
      </div>
    </div>
  );
}
