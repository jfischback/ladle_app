"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { cooks, extraItems, foundRecipes, pantryItems, plans, recipes } from "@/db/schema";
import { activePlans, getPlan, getSettings, myExtras, myPantry, myRecipes, recipesByIds } from "@/lib/data";
import { adoptFoundRecipe, refreshCooks } from "@/lib/cooks";
import { ruleProblems } from "@/lib/diet";
import { buildGroceryList, saleNote } from "@/lib/grocery";
import { stapleTerm, staplesTotal } from "@/lib/staples";
import { FOUND_PREFIX, planWeek, sumCosts, type NewRecipeOption } from "@/lib/planner";
import { recipeSales, scanSales, type SaleScan } from "@/lib/sales";
import { leftoverNotes, planLunches } from "@/lib/lunch";
import { BREAKFAST_MEAT_TERMS, breakfastDeal, planBreakfasts } from "@/lib/breakfast";
import { CATEGORIES, extraSearchTerm, extrasTotal, neverRegex, planExtras, termsToCheck } from "@/lib/extras";
import { applyPantry, pantrySearchTerm, sameThing } from "@/lib/pantry";
import { fuelGroceries, fuelTerms, portionNotes } from "@/lib/athletes";
import { athleteWeeks } from "@/lib/athlete-week";
import { canCook } from "@/lib/prep";
import { leftoverKind } from "@/lib/leftovers";
import { recipeMultipliers } from "@/lib/scaling";
import { mergeDuplicates } from "@/lib/grocery-merge";
import { healthGroceryNotes, healthNeeds } from "@/lib/health";
import { budgetNotes, cookOnceEatTwice, dinnerCost, enforceCap, fillCosts, rebalanceBatches } from "@/lib/budget";
import type { PlanDay, SaleCheck, SaleItem, StapleLine } from "@/lib/types";
import type { Settings } from "@/lib/settings";
import { addDays, dayName, upcomingWeekStart, weekDates } from "@/lib/week";
import { TOO_MANY, under } from "@/lib/rate-limit";
import { moveDinner } from "@/lib/move-dinner";
import { today } from "@/lib/week";

export type ActionResult = { error?: string } | void;

async function archiveOthersForWeek(userId: string, weekOf: string, keepId?: string) {
  const db = await getDb();
  // Only drafts: an approved week (and its grocery list) is only ever replaced on purpose, through "Re-plan".
  const conds = [eq(plans.userId, userId), eq(plans.weekOf, weekOf), isNull(plans.archivedAt), eq(plans.status, "draft")];
  if (keepId) conds.push(ne(plans.id, keepId));
  await db.update(plans).set({ archivedAt: new Date() }).where(and(...conds));
}

/** The Plan button: check this week's prices at their Fry's, ask Claude for the week, save it as a draft. */
export async function planUpcomingWeek(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await under("plan", userId))) return { error: TOO_MANY };
  const { data: settings } = await getSettings(userId);
  const weekStart = upcomingWeekStart(settings.shoppingDay);
  const recipeList = await myRecipes(userId);
  if (recipeList.length < settings.dinnersPerWeek) {
    return { error: `You need at least ${settings.dinnersPerWeek} dinners in My Recipes to plan a week.` };
  }
  const fitting = recipeList.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && canCook(r, settings.equipment) && !(r.rating != null && r.rating <= 2)).length;
  if (fitting < settings.dinnersPerWeek) {
    return {
      error: `Only ${fitting} of your recipes fit your food rules, and you cook ${settings.dinnersPerWeek} nights. Add a few more recipes that fit (your cooks are a good place to look), or cook fewer nights in Settings.`,
    };
  }
  const windowStart = addDays(weekStart, -7 * settings.noRepeatWeeks);
  const allPlans = await activePlans(userId);
  const recent = allPlans.filter(
    (p) => p.status === "approved" && p.weekOf >= windowStart && p.weekOf < weekStart,
  );

  // A failed price check never blocks planning: the week is planned without sales and the home screen says why.
  const stockTerms = (await myPantry(userId)).filter((p) => p.onSaleOnly && p.status !== "have").map((p) => pantrySearchTerm(p.name));
  const wantsBreakfastDeal = settings.breakfastMeatDeal && settings.breakfastDays.length > 0;
  // Snacks, sweets, drinks and baby items: what to price-check, and never-buy words for "any brand" items.
  const extras = await myExtras(userId);
  // Athlete mode: price-check the high-protein snacks too, so on-sale ones come first.
  const extraTerms = [...termsToCheck(extras), ...fuelTerms(settings.athletes, settings.foodRules, settings.dislikes, settings.allowAnyway)];
  const exclude = new Map<string, RegExp>();
  for (const x of extras) {
    const re = x.anyBrand ? neverRegex(settings.extras[x.category]?.neverWords ?? []) : null;
    if (re) exclude.set(extraSearchTerm(x.name), re);
  }
  let scan: SaleScan;
  try {
    scan = await scanSales(recipeList, settings, [...stockTerms, ...(wantsBreakfastDeal ? BREAKFAST_MEAT_TERMS : []), ...extraTerms], exclude);
  } catch (e) {
    scan = { status: "failed", message: (e as Error).message };
  }
  const at = new Date().toISOString();
  const saleCheck: SaleCheck =
    scan.status === "ok" ? { status: "ok", checked: scan.checked, at }
    : scan.status === "off" ? { status: "off", reason: scan.reason, at }
    : { status: "failed", message: scan.message, at };
  const sales = scan.status === "ok" ? scan.sales : [];
  const newRecipes = settings.newRecipesPerWeek > 0 ? await newRecipeOptions(userId, sales, settings) : [];
  const staples = stapleLines(settings, scan);
  // "Buy on sale" pantry items that are running low and really on sale this week.
  const stockUp = scan.status === "ok" ? scan.sales.filter((s) => stockTerms.includes(s.item)) : [];
  const bDeal = wantsBreakfastDeal && scan.status === "ok" ? breakfastDeal(scan.sales) : null;
  let extraLines = planExtras(extras, settings.extras, scan.status === "ok" ? scan.sales : [], scan.status === "ok" ? scan.staplePrices : new Map());

  let result;
  try {
    result = await planWeek({
      settings, weekStart, recipes: recipeList, recentPlans: recent, history: allPlans.filter((p) => p.status === "approved"),
      saleItems: sales, storePrices: scan.status === "ok" ? scan.prices : [], newRecipes,
      staplesCost: staplesTotal(staples).total + extrasTotal(extraLines),
    });
  } catch (e) {
    return { error: `The planner hit a problem: ${(e as Error).message}` };
  }

  // New recipes the planner picked become the user's own (in "trial" until the week is approved).
  const db = await getDb();
  await Promise.all(
    result.days.map(async (d, i) => {
      if (!d.recipeId?.startsWith(FOUND_PREFIX)) return;
      const foundId = d.recipeId.slice(FOUND_PREFIX.length);
      const [row] = await db
        .select({ found: foundRecipes, cookName: cooks.name })
        .from(foundRecipes)
        .innerJoin(cooks, eq(cooks.id, foundRecipes.cookId))
        .where(and(eq(foundRecipes.id, foundId), eq(foundRecipes.userId, userId)));
      try {
        if (!row) throw new Error("gone");
        const recipeId = await adoptFoundRecipe(userId, row.found, { name: row.cookName }, true);
        const [r] = await recipesByIds(userId, [recipeId]);
        result.days[i] = { ...d, recipeId, recipeName: r?.name ?? d.recipeName };
      } catch {
        // Couldn't bring it in: fall back to the first alternative from their own recipes, or a night off.
        const alt = d.alternatives[0];
        result.days[i] = alt
          ? { ...d, recipeId: alt.recipeId, recipeName: alt.recipeName, reason: "One of your recipes", fromCook: null, alternatives: d.alternatives.slice(1) }
          : { ...d, recipeId: null, recipeName: null, reason: "No-cook night", fromCook: null, saleItems: [], alternatives: [] };
      }
    }),
  );
  // Costs for every dinner (the basic planner doesn't estimate them), then the budget rules.
  const planned = await recipesByIds(userId, result.days.map((d) => d.recipeId).filter((x): x is string => !!x));
  const byId = new Map([...recipeList, ...planned].map((r) => [r.id, r]));
  result.days = fillCosts(result.days, byId, settings, sales);
  if (settings.cookOnceEatTwice) result.days = cookOnceEatTwice(result.days, byId).days;
  if (settings.budgetMode === "hard" || settings.tightBudget) {
    const recentIds = new Set(recent.flatMap((p) => p.days.map((d) => d.recipeId)).filter((x): x is string => !!x));
    let capped = enforceCap(result.days, recipeList, settings, sales, staplesTotal(staples).total + extrasTotal(extraLines), recentIds);
    // Every dollar counts: if dinners alone can't fit, the optional snacks go first (every-trip and running-low items stay).
    if (capped.over > 0 && settings.tightBudget) {
      // Baby food is never cut.
      extraLines = extraLines.filter((l) => l.category === "baby" || /^Every trip|You're out|Running low/.test(l.reason));
      capped = enforceCap(capped.days, recipeList, settings, sales, staplesTotal(staples).total + extrasTotal(extraLines), recentIds);
    }
    result.days = capped.days;
  }
  result.estimatedTotal = sumCosts(result.days);
  result.days = await withLunches(userId, await withBreakfasts(userId, result.days, settings, sales, bDeal), settings, sales);

  await archiveOthersForWeek(userId, weekStart);
  await db.insert(plans).values({
    userId,
    weekOf: weekStart,
    status: "draft",
    days: result.days,
    saleItems: sales,
    saleCheck,
    staples,
    stockUp,
    breakfastDeal: bDeal,
    extras: extraLines,
    summary: result.summary,
    plannerSource: result.source,
    estimatedTotal: result.estimatedTotal,
  });
  revalidatePath("/");
}

export async function swapDay(planId: string, dayIndex: number, recipeId: string | null): Promise<ActionResult> {
  const userId = await requireUserId();
  const plan = await getPlan(userId, planId);
  if (!plan || plan.status !== "draft") return { error: "This plan is already approved." };
  const day = plan.days[dayIndex];
  if (!day) return { error: "Day not found." };

  const { data: settings } = await getSettings(userId);
  const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
  if (recipeId === null) {
    plan.days[dayIndex] = { ...day, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [], fromCook: null, leftoverOf: null, batches: undefined };
  } else {
    const [recipe] = await recipesByIds(userId, [recipeId]);
    if (!recipe) return { error: "Recipe not found." };
    if (plan.days.some((d, i) => i !== dayIndex && d.recipeId === recipeId)) return { error: `${recipe.name} is already on another night this week.` };
    const alt = day.alternatives.find((a) => a.recipeId === recipeId);
    const previous =
      day.recipeId && day.recipeName
        ? [{ recipeId: day.recipeId, recipeName: day.recipeName, estimatedCost: day.estimatedCost, reason: day.reason }]
        : [];
    plan.days[dayIndex] = {
      ...day,
      recipeId,
      recipeName: recipe.name,
      estimatedCost: alt?.estimatedCost ?? dinnerCost(recipe, settings, sales).total,
      reason: alt?.reason ?? "Your pick",
      leftoverOf: null,
      batches: undefined, // priced as one batch here; rebalanced below if it feeds a leftovers night
      saleItems: recipeSales(recipe, plan.saleItems.filter((x): x is SaleItem => typeof x !== "string")),
      fromCook: recipe.trial ? recipe.creditName : null,
      alternatives: [...previous, ...day.alternatives.filter((a) => a.recipeId !== recipeId)].slice(0, 3),
    };
  }
  // A leftovers night follows the dinner it came from: the new dinner if it reheats well, otherwise a night off.
  const now = plan.days[dayIndex];
  plan.days = plan.days.map((d) => (d.leftoverOf === day.date && now.recipeId ? { ...d, recipeId: now.recipeId, recipeName: now.recipeName } : d));
  const cookIds = [...new Set(plan.days.filter((d) => d.recipeId && !d.leftoverOf).map((d) => d.recipeId!))];
  const cooked = new Map((await recipesByIds(userId, cookIds)).map((r) => [r.id, r]));
  plan.days = rebalanceBatches(plan.days, (id) => { const r = cooked.get(id); return !!r && leftoverKind(r) === "ok"; });
  // Lunches depend on the night before, so re-plan them after any dinner change.
  plan.days = await withLunches(userId, plan.days, settings, sales);
  const db = await getDb();
  await db
    .update(plans)
    .set({ days: plan.days, estimatedTotal: sumCosts(plan.days) })
    .where(and(eq(plans.id, planId), eq(plans.status, "draft")));
  revalidatePath("/");
}

/** Plan the week's lunches from the dinners (leftovers first, then lunch recipes). */
async function withLunches(userId: string, days: PlanDay[], settings: Settings, sales: SaleItem[]): Promise<PlanDay[]> {
  const needsLunch = settings.lunchDays.length > 0 || settings.holidayEveryoneHome;
  if (!needsLunch) return days.map((d) => ({ ...d, lunch: null }));
  const dinnerIds = days.map((d) => d.recipeId).filter((x): x is string => !!x);
  const breakfastIds = days.map((d) => d.breakfast?.recipeId).filter((x): x is string => !!x);
  const [dinnerRows, lunchPool, breakfastRows] = await Promise.all([recipesByIds(userId, dinnerIds), myRecipes(userId, "lunch"), recipesByIds(userId, breakfastIds)]);
  return planLunches(days, settings, new Map(dinnerRows.map((r) => [r.id, r])), lunchPool, sales, new Map(breakfastRows.map((r) => [r.id, r])));
}

/** Plan the week's breakfasts (quick, the household's bread/egg mix, must-haves, the breakfast-meat deal). */
async function withBreakfasts(userId: string, days: PlanDay[], settings: Settings, sales: SaleItem[], deal: SaleItem | null): Promise<PlanDay[]> {
  if (!settings.breakfastDays.length && !settings.holidayEveryoneHome) return days.map((d) => ({ ...d, breakfast: null }));
  return planBreakfasts(days, settings, await myRecipes(userId, "breakfast"), sales, deal);
}

/** The human gate: lock the plan and build the grocery list. Cart fill comes later; never checkout. */
export async function approvePlan(planId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await under("approve", userId))) return { error: TOO_MANY };
  const plan = await getPlan(userId, planId);
  if (!plan) return { error: "Plan not found." };
  if (plan.status === "approved") return;
  if (plan.archivedAt) return { error: "This week was replaced. Refresh the page to see the current plan." };
  const { data: settings } = await getSettings(userId);
  const ids = plan.days.map((d) => d.recipeId).filter((x): x is string => !!x);
  // Lunch recipes need shopping too (leftover lunches are covered by cooking extra at dinner).
  const lunchIds = plan.days.flatMap((d) => [d.lunch?.kind === "recipe" ? d.lunch.recipeId : null, d.breakfast?.recipeId ?? null]).filter((x): x is string => !!x);
  const chosen = await recipesByIds(userId, [...new Set([...ids, ...lunchIds])]);
  let groceryList;
  try {
    const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
    const athletes = await athleteWeeks(userId, plan, settings);
    // How many times to make each recipe: household size, double batches, leftover lunches, athletes' extra portions.
    const extraPortions = athletes.reduce((n, w) => {
      const dinners = w.days.flatMap((d) => d.meals.filter((m) => m.meal === "Dinner" && !m.estimated));
      return n + (dinners.length ? dinners.reduce((a, m) => a + m.portion, 0) / dinners.length - 1 : 0);
    }, 0);
    const servingsById = new Map(chosen.map((r) => [r.id, r.servings]));
    const makeTimes = recipeMultipliers(plan.days, (id) => servingsById.get(id) ?? null, settings, extraPortions);
    // Say which recipes the list buys at half size, so nobody cooks the full recipe from half the groceries.
    const halves = chosen.filter((r) => makeTimes.get(r.id) === 0.5).map((r) => r.name);
    const halfNote = halves.length ? [`Half batches for your household (the amounts on this list are for half the recipe): ${halves.join(", ")}.`] : [];
    groceryList = await buildGroceryList(chosen, settings, sales, [...leftoverNotes(plan.days), ...budgetNotes(plan.days), ...healthGroceryNotes(healthNeeds(settings.athletes)), ...portionNotes(athletes), ...halfNote], makeTimes);
    // Weekly staples get their own section, with this week's sale prices where we found them.
    const snap = new Map((plan.staples ?? []).map((l) => [stapleTerm(l.item), l]));
    const items = settings.staples.filter((x) => x.active).map((x) => {
      const sale = snap.get(stapleTerm(x.item))?.sale;
      return { item: x.item, quantity: x.quantity, note: sale ? saleNote(sale) : "", forRecipes: [] };
    });
    if (items.length) groceryList = { ...groceryList, sections: [{ name: "Weekly staples", items }, ...groceryList.sections] };
    // Snacks, sweets, drinks and baby items, one section each.
    for (const c of CATEGORIES) {
      const lines = (plan.extras ?? []).filter((l) => l.category === c.key);
      if (lines.length) groceryList = { ...groceryList, sections: [...groceryList.sections, { name: c.label, items: lines.map((l) => ({ item: l.item, quantity: String(l.quantity), note: [l.product && l.product.toLowerCase() !== l.item.toLowerCase() ? l.product : "", l.sale ? saleNote(l.sale) : "", l.reason.replace(/(^| · )on sale$/i, "").replace(/^On sale$/, "")].filter(Boolean).join(" · "), forRecipes: [] })) }] };
    }
    // Athlete mode: the high-protein snacks and shakes for the week.
    const fuel = fuelGroceries(athletes, sales);
    if (fuel.length) groceryList = { ...groceryList, sections: [...groceryList.sections, { name: "Athlete fuel", items: fuel }] };
    // This week's breakfast-meat deal, for the egg breakfasts.
    if (plan.breakfastDeal && plan.days.some((d) => d.breakfast?.withDeal)) {
      const d = plan.breakfastDeal;
      groceryList = { ...groceryList, sections: [...groceryList.sections, { name: "Breakfast meat deal", items: [{ item: d.product, quantity: d.size, note: saleNote(d), forRecipes: plan.days.filter((x) => x.breakfast?.withDeal).map((x) => x.breakfast!.name) }] }] };
    }
    // Pantry check: skip what's on hand, ask about long-lasting items we don't know, add on-sale stock-ups.
    const pantry = await myPantry(userId);
    // One line per thing: eggs in the staples, a recipe and athlete fuel become one line with the amounts added.
    groceryList = mergeDuplicates(groceryList);
    groceryList = applyPantry(groceryList, pantry, plan.stockUp ?? [], saleNote);
    // Low/out pantry items on this week's list (stock-ups included) will be bought, so they're "have" from now on.
    const bought = new Set(groceryList.sections.filter((s) => !/already in your pantry|pantry check/i.test(s.name)).flatMap((s) => s.items.map((i) => i.item)));
    const restocked = pantry.filter((p) => p.status !== "have" && ([...bought].some((b) => sameThing(b, p.name)) || (plan.stockUp ?? []).some((s) => s.item === pantrySearchTerm(p.name))));
    if (restocked.length) {
      const db = await getDb();
      await db.update(pantryItems).set({ status: "have", updatedAt: new Date() }).where(and(eq(pantryItems.userId, userId), inArray(pantryItems.id, restocked.map((p) => p.id))));
    }
  } catch (e) {
    return { error: `Couldn't build the grocery list: ${(e as Error).message}` };
  }
  const db = await getDb();
  await db
    .update(plans)
    .set({ status: "approved", approvedAt: new Date(), groceryList })
    .where(and(eq(plans.id, planId), eq(plans.status, "draft"), isNull(plans.archivedAt)));
  // Remember what was bought, so "rotate" items take turns and "when low" items count as restocked.
  const boughtExtras = new Set((plan.extras ?? []).map((l) => `${l.category}|${l.item}`));
  if (boughtExtras.size) {
    const all = await myExtras(userId);
    for (const x of all.filter((x) => boughtExtras.has(`${x.category}|${x.name}`))) {
      await db.update(extraItems).set({ lastPickedAt: new Date(), ...(x.mode === "when-low" ? { status: "have" as const } : {}) }).where(eq(extraItems.id, x.id));
    }
  }
  // New recipes in an approved week join My Recipes for good.
  const trialIds = chosen.filter((r) => r.trial).map((r) => r.id);
  if (trialIds.length) {
    await db.update(recipes).set({ trial: false, updatedAt: new Date() }).where(and(inArray(recipes.id, trialIds), eq(recipes.ownerId, userId)));
    await db.update(foundRecipes).set({ status: "saved" }).where(and(inArray(foundRecipes.recipeId, trialIds), eq(foundRecipes.userId, userId)));
    revalidatePath("/recipes");
  }
  revalidatePath("/");
  revalidatePath("/history");
}

/** This week's staples with the prices (and sales) the Fry's check found. */
function stapleLines(settings: Settings, scan: SaleScan): StapleLine[] {
  return settings.staples
    .filter((x) => x.active)
    .map((x) => {
      const term = stapleTerm(x.item);
      const found = scan.status === "ok" ? scan.staplePrices.get(term) : undefined;
      const sale = scan.status === "ok" ? (scan.sales.find((s) => s.item === term) ?? null) : null;
      return { item: x.item, quantity: x.quantity, price: sale?.salePrice ?? found?.price ?? null, sale };
    });
}

/**
 * Candidates for "something new this week": unseen dinners from followed cooks that list their ingredients,
 * best sale matches first, then newest. Checks the cooks for new posts first (quickly; at most once a day).
 */
async function newRecipeOptions(userId: string, sales: SaleItem[], settings: Settings): Promise<NewRecipeOption[]> {
  await refreshCooks(userId, { budgetMs: 8000, minHours: 24 }).catch(() => {});
  const db = await getDb();
  const rows = await db
    .select({ found: foundRecipes, cookName: cooks.name })
    .from(foundRecipes)
    .innerJoin(cooks, eq(cooks.id, foundRecipes.cookId))
    .where(and(eq(foundRecipes.userId, userId), eq(foundRecipes.status, "new"), isNull(cooks.archivedAt)))
    .orderBy(desc(foundRecipes.publishedAt))
    .limit(150);
  const seen = new Set<string>();
  return rows
    .filter(({ found }) => found.ingredients.length >= 3 && !ruleProblems(found, settings.foodRules, settings.dislikes, settings.allowAnyway).length)
    .filter(({ found }) => !seen.has(found.title.toLowerCase()) && seen.add(found.title.toLowerCase()))
    .map(({ found, cookName }, i) => ({ opt: { foundId: found.id, title: found.title, cookName, ingredients: found.ingredients, totalMinutes: found.totalMinutes }, rank: i }))
    .sort((a, b) => recipeSales(b.opt, sales).length - recipeSales(a.opt, sales).length || a.rank - b.rank)
    .slice(0, 8)
    .map((x) => x.opt);
}

/** Trade two nights' dinners, even after shopping ("do Tuesday's on Thursday"). The grocery list doesn't change. */
export async function moveDinnerTo(planId: string, from: number, to: number): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: "Plan not found." };
  const plan = await getPlan(userId, planId);
  if (!plan) return { error: "Plan not found." };
  if (plan.archivedAt) return { error: "This week was replaced. Refresh the page to see the current plan." };
  if (!Number.isInteger(from) || !Number.isInteger(to)) return { error: "Pick another night." };
  const moved = moveDinner(plan.days, from, to, today());
  if ("error" in moved) return { error: moved.error };
  const db = await getDb();
  await db.update(plans).set({ days: moved.days }).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/");
}

/** Archive this week's plan so the user can plan again. Nothing is deleted. */
export async function startOver(planId: string) {
  const userId = await requireUserId();
  const db = await getDb();
  await db
    .update(plans)
    .set({ archivedAt: new Date() })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/");
  revalidatePath("/history");
}

/** Rating prompt after each cook. stars = null means "skip". */
export async function rateCookedDinner(planId: string, dayIndex: number, stars: number | null, kidVotes: Record<string, number> = {}) {
  const userId = await requireUserId();
  const plan = await getPlan(userId, planId);
  const day = plan?.days[dayIndex];
  if (!plan || !day?.recipeId) return;
  const db = await getDb();
  if (stars != null && Number.isInteger(stars) && stars >= 1 && stars <= 5) {
    await db
      .update(recipes)
      .set({ rating: stars, updatedAt: new Date() })
      .where(and(eq(recipes.id, day.recipeId), eq(recipes.ownerId, userId)));
  }
  // "Did the kids eat it?": remembered per picky eater, so the planner learns what works.
  const votes = Object.entries(kidVotes).filter(([k, v]) => /^[a-z0-9]{1,20}$/i.test(k) && (v === 1 || v === -1));
  if (votes.length) {
    const [r] = await db.select({ kidVotes: recipes.kidVotes }).from(recipes).where(and(eq(recipes.id, day.recipeId), eq(recipes.ownerId, userId)));
    if (r) await db.update(recipes).set({ kidVotes: { ...(r.kidVotes ?? {}), ...Object.fromEntries(votes) } }).where(and(eq(recipes.id, day.recipeId), eq(recipes.ownerId, userId)));
  }
  plan.days[dayIndex] = { ...day, ratedAt: new Date().toISOString() };
  await db.update(plans).set({ days: plan.days }).where(eq(plans.id, planId));
  revalidatePath("/");
  revalidatePath("/recipes");
}

export async function setActualSpend(planId: string, form: FormData) {
  const userId = await requireUserId();
  const raw = String(form.get("actualSpend") ?? "").replace(/[$,\s]/g, "");
  const value = raw === "" ? null : Number(raw);
  if (value != null && (!Number.isFinite(value) || value < 0 || value > 100000)) return;
  const db = await getDb();
  await db
    .update(plans)
    .set({ actualSpend: value })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/history");
}

/** History: reuse a past week as the starting point for the upcoming week. */
export async function reuseWeek(planId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const source = await getPlan(userId, planId);
  if (!source) return { error: "Plan not found." };
  const { data: settings } = await getSettings(userId);
  const weekStart = upcomingWeekStart(settings.shoppingDay);
  const dates = weekDates(weekStart);
  const existing = (await activePlans(userId)).find((p) => p.weekOf === weekStart && p.status === "approved");
  if (existing) return { error: "That week is already approved. Tap \"Re-plan this week\" on the home screen first if you want to replace it." };
  // Only recipes still in the box that fit today's food rules and kitchen.
  const box = (await myRecipes(userId)).filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && canCook(r, settings.equipment));
  const live = new Map(box.map((r) => [r.id, r]));
  let days: PlanDay[] = dates.map((date, i) => {
    const d = source.days[i];
    const r = d?.recipeId ? live.get(d.recipeId) : undefined;
    // A leftovers night keeps pointing at its cooking night (same weekday in the new week).
    const from = d?.leftoverOf ? source.days.findIndex((x) => x.date === d.leftoverOf) : -1;
    return {
      date,
      recipeId: r ? r.id : null,
      recipeName: r ? r.name : null,
      estimatedCost: r && !d.leftoverOf ? dinnerCost(r, settings, []).total : r ? 0 : null,
      reason: r ? (d.leftoverOf ? `Leftovers from ${dayName(dates[from] ?? date)}: cook once, eat twice` : `Reused from week of ${source.weekOf}`) : "No-cook night",
      saleItems: [],
      alternatives: [],
      leftoverOf: r && from >= 0 ? dates[from] : null,
    };
  });
  // Double batches priced again for today's prices and household; breakfasts and lunches planned fresh.
  days = rebalanceBatches(days, (id) => { const r = live.get(id); return !!r && leftoverKind(r) === "ok"; });
  days = await withLunches(userId, await withBreakfasts(userId, days, settings, [], null), settings, []);
  const db = await getDb();
  await archiveOthersForWeek(userId, weekStart);
  await db.insert(plans).values({
    userId,
    weekOf: weekStart,
    status: "draft",
    days,
    saleItems: [],
    summary: `Started from your week of ${source.weekOf}. Swap anything you like, then approve.`,
    plannerSource: "basic",
    estimatedTotal: sumCosts(days),
  });
  revalidatePath("/");
}
