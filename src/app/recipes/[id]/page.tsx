import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { activePlans, getRecipe, getSettings } from "@/lib/data";
import { recipeSaleSummary, saleEnds } from "@/lib/sale-summary";
import { ruleProblems } from "@/lib/diet";
import { addStarter, archiveRecipe } from "@/app/actions/recipes";
import { RecipeRating } from "./RecipeRating";
import { LeftoversSwitch } from "./LeftoversSwitch";
import { leftoverKind, leftoverWhy } from "@/lib/leftovers";
import { formatMinutes } from "@/lib/format";
import { FoodArt } from "@/components/FoodArt";
import { IngredientList } from "./IngredientList";
import { CookMode } from "./CookMode";
import { dinnerServings } from "@/lib/scaling";
import { RecipeNotes } from "./RecipeNotes";
import { ShareRecipe } from "./ShareRecipe";
import { estimateCost, estimateNutrition, estimateSodium, trustworthy } from "@/lib/nutrition";

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cook?: string; batches?: string; for?: string; from?: string; times?: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getRecipe(userId, id);
  const { data: settings } = await getSettings(userId);
  if (!r) notFound();
  const problems = ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway);
  const mine = r.ownerId === userId;
  const nutrition = estimateNutrition(r);
  const sodium = estimateSodium(r);
  const cost = estimateCost(r);
  // This week's sales (from the newest plan's price check): how much of this recipe is on sale.
  const salePlan = (await activePlans(userId)).find((p) => p.saleItems.some((x) => typeof x === "object"));
  const onSale = salePlan ? recipeSaleSummary(r, salePlan.saleItems) : null;
  const cookNow = sp.cook === "1";
  // Dinners open sized for the family (times the batches tonight cooks: a double batch for a leftovers night).
  const batches = Math.min(3, Math.max(1, Math.round(Number(sp.batches)) || 1));
  // The same rounding as the grocery list: to the nearest half recipe, rounded up.
  // "Who's eating tonight?" (?for=adults-kids): tonight's batch is for them; any other batches are the usual table.
  const forMatch = (sp.for ?? "").match(/^(\d{1,2})-(\d{1,2})$/);
  const tonight = forMatch ? { adults: Number(forMatch[1]), kids: Number(forMatch[2]) } : null;
  const plates = (tonight && tonight.adults + tonight.kids > 0 ? dinnerServings(tonight) : dinnerServings(settings)) + dinnerServings(settings) * (batches - 1);
  // Opened from the week: ?times= is how many times the grocery list made this recipe (dinner, a leftovers night,
  // leftover lunches, athletes' portions), so the amounts to cook match what was bought.
  const listTimes = Number(sp.times);
  const fromList = r.servings && Number.isFinite(listTimes) && listTimes >= 0.5 && listTimes <= 12 && (listTimes * 2) % 1 === 0 ? listTimes : null;
  const familyServings = fromList ? Math.round(r.servings! * fromList) : r.meal === "dinner" && r.servings ? Math.round(r.servings * Math.max(0.5, Math.ceil((plates / r.servings) * 2) / 2)) : null;
  const sizedWhy = fromList ? "Sized to match this week's grocery list: dinner plus any leftovers night and leftover lunches that come from this pot." : familyServings ? (tonight ? `Sized for tonight's table: ${tonight.adults} adult${tonight.adults === 1 ? "" : "s"}${tonight.kids ? ` and ${tonight.kids} kid${tonight.kids === 1 ? "" : "s"}` : ""}${batches > 1 ? ", plus the leftovers night" : ""}.` : batches > 1 ? `Sized for your family, times ${batches} for the leftovers night.` : "Sized for your family. Cooking extra for tomorrow's lunch? Add those servings.") : null;

  return (
    <article className="space-y-6">
      {/* Opened from a dinner on Home: back goes to the week, not the whole recipe box. */}
      {/^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? (
        <Link href={`/?week=${sp.from}#dinners`} className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
      ) : (
        <Link href={mine ? "/recipes" : "/recipes?tab=browse"} className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← All recipes</Link>
      )}

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
            {r.meal !== "dinner" && <span className="tag bg-olive-soft font-bold text-olive-dark">{r.meal === "lunch" ? "🥪 Lunch" : r.meal === "dessert" ? "🍰 Dessert" : "☕ Breakfast"}</span>}
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

      {!mine && (
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

      {/* The recipe itself comes first; ratings, notes and the numbers follow. */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Ingredients</h2>
          <ShareRecipe recipe={{ id: r.id, name: r.name, servings: r.servings, totalMinutes: r.totalMinutes, ingredients: r.ingredients, steps: r.steps, creditName: r.creditName, creditUrl: r.creditUrl }} />
        </div>
        {r.ingredients.length ? <IngredientList recipeId={r.id} ingredients={r.ingredients} servings={r.servings} familyServings={familyServings} why={sizedWhy} /> : <p className="text-muted">No ingredients yet.</p>}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Let&apos;s cook</h2>
          <CookMode recipeId={r.id} name={r.name} steps={r.steps} ingredients={r.ingredients} startOpen={cookNow} notes={mine ? r.familyNotes : null} />
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
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-3">
            <RecipeRating id={r.id} rating={r.rating} />
            {r.meal === "dinner" && <LeftoversSwitch id={r.id} good={leftoverKind(r) === "ok"} why={leftoverWhy(r)} />}
          </div>
          <Link href={`/recipes/${r.id}/edit`} className="btn-secondary">Edit</Link>
        </div>
      )}

      {mine && <RecipeNotes id={r.id} notes={r.familyNotes} />}

      {trustworthy(nutrition) && (
        <section aria-label="Per serving" className="card p-4">
          <p className="mb-2 font-bold">Per serving <span className="font-normal text-muted">(estimated from the ingredients)</span></p>
          <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              ["Calories", `${nutrition.kcal}`],
              ["Protein", `${nutrition.protein} g`],
              ["Carbs", `${nutrition.carbs} g`],
              ["Fat", `${nutrition.fat} g`],
              ["Sodium", `${sodium.toLocaleString("en-US")} mg`],
              ...(cost.coverage >= 0.7 ? [["Cost", `$${cost.perServing.toFixed(2)}`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-cream/80 p-2">
                <dt className="text-xs font-bold text-muted">{k}</dt>
                <dd className="font-display text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {onSale && onSale.total > 0 && (
        <section aria-labelledby="sale-title" className="rounded-3xl bg-ochre-soft p-4 shadow-soft">
          <h2 id="sale-title" className="text-lg font-bold">
            🏷️ {onSale.onSale.length ? `${onSale.onSale.length} of ${onSale.total} ingredients on sale this week` : `None of the ${onSale.total} ingredients are on sale this week`}
            {onSale.saved >= 0.5 && <span className="font-semibold text-ochre-dark"> · about ${onSale.saved.toFixed(2)} off</span>}
          </h2>
          {onSale.onSale.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {onSale.onSale.map((x) => (
                <li key={x.item} className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold">{x.item}</span>
                  <span>
                    ${x.salePrice.toFixed(2)} <span className="text-muted line-through">${x.regularPrice.toFixed(2)}</span>
                    {saleEnds(x.endsOn) && <span className="text-muted"> · {saleEnds(x.endsOn)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Prices at your store when this week was planned. Pantry basics like salt and oil aren&apos;t counted.</p>
        </section>
      )}

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
