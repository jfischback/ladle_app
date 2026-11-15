import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getRecipe, getSettings } from "@/lib/data";
import { ruleProblems } from "@/lib/diet";
import { addStarter, archiveRecipe } from "@/app/actions/recipes";
import { RecipeRating } from "./RecipeRating";
import { LeftoversSwitch } from "./LeftoversSwitch";
import { leftoverKind, leftoverWhy } from "@/lib/leftovers";
import { formatMinutes } from "@/lib/format";
import { FoodArt } from "@/components/FoodArt";
import { IngredientList } from "./IngredientList";
import { CookMode } from "./CookMode";
import { estimateNutrition, trustworthy } from "@/lib/nutrition";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getRecipe(userId, id);
  const { data: settings } = await getSettings(userId);
  if (!r) notFound();
  const problems = ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway);
  const mine = r.ownerId === userId;
  const nutrition = estimateNutrition(r);

  return (
    <article className="space-y-6">
      <Link href={mine ? "/recipes" : "/recipes?tab=browse"} className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← All recipes</Link>

      <div className="card overflow-hidden">
        <FoodArt name={r.name} protein={r.protein} className="h-52 w-full sm:h-64" rounded="rounded-none" />
        <div className="space-y-3 p-5">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{r.name}</h1>
          <div className="flex flex-wrap gap-2">
            {r.totalMinutes && <span className="tag">⏱ {formatMinutes(r.totalMinutes)}</span>}
            {r.servings && <span className="tag">🍽 Serves {r.servings}</span>}
            {r.protein && <span className="tag">{r.protein}</span>}
            {trustworthy(nutrition) && <span className="tag bg-olive-soft text-olive-dark" title="Estimated from the ingredients">💪 ~{nutrition.protein} g protein · {nutrition.kcal} cal a serving</span>}
            {r.ease && <span className="tag">{r.ease >= 4 ? "Easy" : r.ease >= 3 ? "Medium" : "A bit of work"}</span>}
            {r.meal !== "dinner" && <span className="tag bg-olive-soft font-bold text-olive-dark">{r.meal === "lunch" ? "🥪 Lunch" : "☕ Breakfast"}</span>}
            {r.tags.filter((t) => t !== "leftovers" && t !== "no-leftovers").map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
          {r.creditName && (
            <p className="text-sm text-muted">
              {r.creditUrl ? <a href={r.creditUrl} target="_blank" rel="noopener noreferrer" className="underline">{r.creditName}</a> : r.creditName}
            </p>
          )}
        </div>
      </div>

      {problems.length > 0 && (
        <div className="flex items-start gap-3 rounded-3xl bg-terracotta-soft p-4 shadow-soft" role="note">
          <span className="text-2xl" aria-hidden="true">⚠︎</span>
          <p><span className="font-bold">Doesn&apos;t fit your food rules:</span> {problems.join(", ")}. We won&apos;t plan it.</p>
        </div>
      )}

      {r.trial && (
        <div className="flex items-start gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft">
          <span className="text-2xl" aria-hidden="true">✨</span>
          <p><span className="font-bold">New from {r.creditName ?? "one of your cooks"}.</span> It&apos;s in this week&apos;s plan. Approve the week and it joins your recipes for good.</p>
        </div>
      )}

      {mine ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-3">
            <RecipeRating id={r.id} rating={r.rating} />
            {r.meal === "dinner" && <LeftoversSwitch id={r.id} good={leftoverKind(r) === "ok"} why={leftoverWhy(r)} />}
          </div>
          <Link href={`/recipes/${r.id}/edit`} className="btn-secondary">Edit</Link>
        </div>
      ) : (
        <form action={addStarter.bind(null, r.id)}>
          <button className="btn-warm min-h-12 w-full sm:w-auto">+ Add to my recipes</button>
        </form>
      )}

      {r.prepAhead && (
        <div className="flex items-start gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft">
          <span className="text-2xl" aria-hidden="true">⏰</span>
          <p><span className="font-bold">The day before:</span> {r.prepAhead}</p>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-semibold">Ingredients</h2>
        {r.ingredients.length ? <IngredientList recipeId={r.id} ingredients={r.ingredients} servings={r.servings} /> : <p className="text-muted">No ingredients yet.</p>}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Let&apos;s cook</h2>
          <CookMode recipeId={r.id} name={r.name} steps={r.steps} ingredients={r.ingredients} />
        </div>
        {!r.steps.length && r.creditUrl ? (
          <a href={r.creditUrl} target="_blank" rel="noopener noreferrer" className="card flex items-center justify-between gap-3 p-4 font-bold text-olive-dark hover:shadow-lift">
            <span>See the steps on {r.creditName ?? "the original site"}</span>
            <span aria-hidden="true">↗</span>
          </a>
        ) : r.steps.length ? (
          <ol className="space-y-3">
            {r.steps.map((s, n) => (
              <li key={n} className="card flex gap-4 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta font-extrabold text-cream">{n + 1}</span>
                <p className="pt-1 text-lg leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">No steps yet.</p>
        )}
      </section>

      {mine && (
        <details className="rounded-3xl px-2 text-sm text-muted">
          <summary className="cursor-pointer py-2 font-semibold">More options</summary>
          <form action={archiveRecipe.bind(null, r.id)} className="pb-2">
            <p className="mb-2">Taking this off your list means it won&apos;t be planned anymore. It stays in your records.</p>
            <button className="btn-secondary min-h-10 border-terracotta/40 px-4 text-sm text-terracotta-dark hover:border-terracotta hover:bg-terracotta-soft">Remove from my recipes</button>
          </form>
        </details>
      )}
    </article>
  );
}
