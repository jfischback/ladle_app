"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { cooks, foundRecipes, plans, recipes, type Recipe } from "@/db/schema";
import { activePlans, getPlan, getSettings, myExtras, myPantry, myRecipes, recipesByIds } from "@/lib/data";
import { adoptFoundRecipe, refreshCooks } from "@/lib/cooks";
import { ruleProblems } from "@/lib/diet";
import { buildGroceryList, saleNote } from "@/lib/grocery";
import { stapleTerm, staplesTotal } from "@/lib/staples";
import { FOUND_PREFIX, planWeek, sumCosts, type NewRecipeOption } from "@/lib/planner";
import { recipeSales, scanSales, type SaleScan } from "@/lib/sales";
import { leftoverNotes, planLunches } from "@/lib/lunch";
import { BREAKFAST_MEAT_TERMS, breakfastDeal, planBreakfasts } from "@/lib/breakfast";
import { planDesserts } from "@/lib/dessert";
import { copyStarters } from "@/lib/starters";
import { pickStarters } from "@/lib/starter-pick";
import { CATEGORIES, extraSearchTerm, extrasTotal, neverRegex, planExtras, termsToCheck } from "@/lib/extras";
import { applyPantry, pantrySearchTerm } from "@/lib/pantry";
import { fuelGroceries, fuelTerms, portionNotes } from "@/lib/athletes";
import { athleteWeeks } from "@/lib/athlete-week";
import { canCook } from "@/lib/prep";
import { leftoverKind } from "@/lib/leftovers";
import { dinnerServings, recipeMultipliers } from "@/lib/scaling";
import { mergeDuplicates } from "@/lib/grocery-merge";
import { healthGroceryNotes, householdHealth } from "@/lib/health";
import { budgetNotes, cookOnceEatTwice, dinnerCost, enforceCap, fillCosts, rebalanceBatches } from "@/lib/budget";
import type { PlanDay, SaleCheck, SaleItem, StapleLine } from "@/lib/types";
import type { Settings } from "@/lib/settings";
import { addDays, currentWeekStart, dayName, upcomingWeekStart, weekDates, weekday } from "@/lib/week";
import { TOO_MANY, under } from "@/lib/rate-limit";
import { moveDinner } from "@/lib/move-dinner";
import { updatePlanLocked } from "@/lib/plan-list";
import { readReceipt, usableTotal } from "@/lib/receipt";
import { withFeastSections } from "@/lib/feast-grocery";
import { today } from "@/lib/week";

export type ActionResult = { error?: string } | void;

async function archiveOthersForWeek(userId: string, weekOf: string, keepId?: string) {
  const db = await getDb();
  // Only drafts: an approved week (and its grocery list) is only ever replaced on purpose, through "Re-plan".
  const conds = [eq(plans.userId, userId), eq(plans.weekOf, weekOf), isNull(plans.archivedAt), eq(plans.status, "draft")];
  if (keepId) conds.push(ne(plans.id, keepId));
  await db.update(plans).set({ archivedAt: new Date() }).where(and(...conds));
}

/**
 * The Plan button: check this week's prices at their Fry's, ask Claude for the week, save it as a draft.
 * `thisWeek`: someone just starting mid-week plans the rest of the current week (today to the day before
 * the next shopping day) instead of waiting for the next one.
 */
export async function planUpcomingWeek(thisWeek = false, checkIn?: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await under("plan", userId))) return { error: TOO_MANY };
  const { data: saved } = await getSettings(userId);
  // This week's check-in (from "Plan my week"): it changes this plan only; Settings stay as they are.
  const parsed = checkIn == null ? null : WeekCheckIn.safeParse(checkIn);
  if (parsed && !parsed.success) return { error: "Something in this week's answers didn't look right. Try again." };
  const week = parsed?.data ?? null;
  if (week && !week.cookDays.length) return { error: "Pick at least one night to cook." };
  const settings: Settings = week
    ? {
        ...saved,
        cookDays: week.cookDays,
        dinnersPerWeek: week.cookDays.length,
        busyDays: week.busyDays.filter((d) => week.cookDays.includes(d)),
        weeklyBudget: week.budget ?? saved.weeklyBudget,
        newRecipesPerWeek: week.tryNew ? Math.max(1, saved.newRecipesPerWeek) : 0,
        dessertNights: week.desserts ?? saved.dessertNights,
      }
    : saved;
  const wishes = week ? { useUp: week.useUp.split(/,|\band\b|\n/).map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 10), craving: week.craving.trim() } : undefined;
  const fromDate = thisWeek === true ? today() : undefined;
  const weekStart = fromDate ? currentWeekStart(settings.shoppingDay) : upcomingWeekStart(settings.shoppingDay);
  if (fromDate) {
    const left = weekDates(weekStart).filter((d) => d >= fromDate);
    if (left.length < 2) return { error: "There's only a day left this week: plan the next one instead." };
  }
  // An approved week (and its grocery list) is only replaced on purpose, with "Re-plan this week" on Home.
  if ((await activePlans(userId)).some((p) => p.weekOf === weekStart && p.status === "approved")) return { error: "That week is already approved. To change it, open it on Home and tap \"Re-plan this week.\"" };
  // A short week needs only as many dinners as it has cooking nights.
  const needed = fromDate ? weekDates(weekStart).filter((d) => d >= fromDate && settings.cookDays.includes(weekday(d))).length : settings.dinnersPerWeek;
  if (needed === 0) return { error: "None of your cooking nights are left this week: plan the next one instead." };
  const recipeList = await myRecipes(userId);
  if (recipeList.length < needed) {
    return { error: `You have ${recipeList.length} dinner${recipeList.length === 1 ? "" : "s"} in your recipe box and this plan needs ${needed}. Add more recipes, or go back and pick fewer nights.` };
  }
  const fitting = recipeList.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && canCook(r, settings.equipment) && !(r.rating != null && r.rating <= 2)).length;
  if (fitting < needed) {
    return {
      error: `Only ${fitting} of your recipes fit your food rules and kitchen, and this plan needs ${needed}. Add recipes that fit, or go back and pick fewer nights.`,
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
  const dessertPool = settings.dessertNights > 0 ? await dessertRecipes(userId, settings) : [];
  let scan: SaleScan;
  try {
    // Dessert recipes get price-checked too, so desserts with sale ingredients come first.
    scan = await scanSales([...recipeList, ...dessertPool], settings, [...stockTerms, ...(wantsBreakfastDeal ? BREAKFAST_MEAT_TERMS : []), ...extraTerms], exclude);
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
      settings, weekStart, fromDate, recipes: recipeList, recentPlans: recent, history: allPlans.filter((p) => p.status === "approved"),
      saleItems: sales, storePrices: scan.status === "ok" ? scan.prices : [], newRecipes,
      staplesCost: staplesTotal(staples).total + extrasTotal(extraLines),
      wishes,
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
  // Who's eating on the nights the check-in changed (company, or someone away). This comes before the budget
  // check, so the limit is held against what those nights really cost.
  if (week?.eating.length) {
    result.days = result.days.map((d) => {
      const e = week.eating.find((x) => x.weekday === weekday(d.date));
      return e && d.recipeId && !d.leftoverOf && !(e.adults === settings.adults && e.kids === settings.kids) ? withEating(d, { adults: e.adults, kids: e.kids }, settings) : d;
    });
  }
  let overBy = 0;
  if (settings.budgetMode === "hard" || settings.tightBudget) {
    const recentIds = new Set(recent.flatMap((p) => p.days.map((d) => d.recipeId)).filter((x): x is string => !!x));
    // A cheaper pick is priced for the usual table: price it again for that night's table, then check once more.
    const cap = (days: PlanDay[]) => {
      const out = enforceCap(days, recipeList, settings, sales, staplesTotal(staples).total + extrasTotal(extraLines), recentIds);
      const repriced = out.days.map((d, i) => (d.eating && d.recipeId !== days[i].recipeId && d.estimatedCost != null ? { ...d, estimatedCost: forTable(d.estimatedCost, d.eating, settings) } : d));
      return { days: repriced, over: Math.max(0, Math.round((sumCosts(repriced) ?? 0) + staplesTotal(staples).total + extrasTotal(extraLines) - settings.weeklyBudget)) };
    };
    let capped = cap(result.days);
    if (capped.over > 0) capped = cap(capped.days);
    // Every dollar counts: if dinners alone can't fit, the optional snacks go first (every-trip and running-low items stay).
    if (capped.over > 0 && settings.tightBudget) {
      // Baby food and pet food are never cut.
      extraLines = extraLines.filter((l) => l.category === "baby" || l.category === "pets" || /^Every trip|You're out|Running low/.test(l.reason));
      capped = cap(capped.days);
    }
    result.days = capped.days;
    overBy = capped.over;
  }
  // The limit couldn't be met with this family's recipes: say so plainly, with the plan.
  if (overBy > 0) result.summary = `${result.summary ? `${result.summary} ` : ""}We couldn't get this week under your $${settings.weeklyBudget} limit with the recipes that fit: it's about $${overBy} over. Swap a dinner for a cheaper one, take a night off, or raise the limit.`;
  result.estimatedTotal = sumCosts(result.days);
  result.days = await withLunches(userId, await withBreakfasts(userId, result.days, settings, sales, bDeal), settings, sales);
  const recentDesserts = new Set(recent.flatMap((p) => p.days.map((d) => d.dessert?.recipeId)).filter((x): x is string => !!x));
  result.days = planDesserts(result.days, settings, dessertPool, sales, recentDesserts);

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
    // The goal it was planned with, plus "+cost" when Cost Cutting was on (for "Cost Cutting saved you…").
    mode: settings.tightBudget ? (settings.mode === "workout" ? "workout+cost" : "cost") : settings.mode,
    estimatedTotal: result.estimatedTotal,
    // The budget this week was planned against (the check-in can set one for just this week).
    budget: settings.weeklyBudget,
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
    plan.days[dayIndex] = { ...day, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [], fromCook: null, leftoverOf: null, batches: undefined, eating: null };
  } else {
    const [recipe] = await recipesByIds(userId, [recipeId]);
    if (!recipe) return { error: "Recipe not found." };
    // The screen only offers dinners that fit, but the rule is enforced here too.
    const breaks = ruleProblems(recipe, settings.foodRules, settings.dislikes, settings.allowAnyway);
    if (breaks.length) return { error: `${recipe.name} doesn't fit your food rules (${breaks.join(", ")}).` };
    if (!canCook(recipe, settings.equipment)) return { error: `${recipe.name} needs equipment your kitchen settings say you don't have.` };
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
      // Priced for whoever is eating that night (company, or someone away), like the grocery list will be.
      estimatedCost: forTable(alt?.estimatedCost ?? dinnerCost(recipe, settings, sales).total, day.eating, settings),
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

/**
 * The household's dessert recipes. A family that turns desserts on before having any gets the starter desserts
 * that fit their food rules and kitchen (once), so dessert night works right away.
 */
async function dessertRecipes(userId: string, settings: Settings): Promise<Recipe[]> {
  const mine = await myRecipes(userId, "dessert");
  if (mine.length) return mine;
  const db = await getDb();
  const starters = await db.select().from(recipes).where(and(isNull(recipes.ownerId), eq(recipes.meal, "dessert"), isNull(recipes.archivedAt)));
  await copyStarters(userId, pickStarters(starters, settings).map((s) => s.id));
  return myRecipes(userId, "dessert");
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
  const lunchIds = plan.days.flatMap((d) => [d.lunch?.kind === "recipe" ? d.lunch.recipeId : null, d.breakfast?.recipeId ?? null, d.dessert?.recipeId ?? null]).filter((x): x is string => !!x);
  const chosen = await recipesByIds(userId, [...new Set([...ids, ...lunchIds])]);
  // Food rules can change after a week is planned (a new allergy, an edited recipe): check every meal again now.
  const broken = chosen.map((r) => ({ r, why: ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway) })).filter((x) => x.why.length);
  if (broken.length) {
    return { error: `${broken.map((x) => `${x.r.name} (${x.why.join(", ")})`).join("; ")} ${broken.length === 1 ? "doesn't" : "don't"} fit your food rules any more. Swap ${broken.length === 1 ? "it" : "them"}, or plan the week again, then approve.` };
  }
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
    const tableNotes = plan.days.filter((d) => d.eating && d.recipeId && !d.leftoverOf).map((d) => `${dayName(d.date)}'s ${d.recipeName} is sized for ${d.eating!.adults} adult${d.eating!.adults === 1 ? "" : "s"}${d.eating!.kids ? ` and ${d.eating!.kids} kid${d.eating!.kids === 1 ? "" : "s"}` : ""}.`);
    const halfNote = halves.length ? [`Half batches for your household (the amounts on this list are for half the recipe): ${halves.join(", ")}.`] : [];
    groceryList = await buildGroceryList(chosen, settings, sales, [...leftoverNotes(plan.days), ...budgetNotes(plan.days), ...healthGroceryNotes(householdHealth(settings)), ...portionNotes(athletes), ...halfNote, ...tableNotes], makeTimes);
    // A holiday feast (Thanksgiving) gets its own section, sized for the guests.
    groceryList = withFeastSections(groceryList, plan.days, sales);
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
    // Nothing is marked bought here: that happens when things are ticked off the list or sent to the store cart.
  } catch (e) {
    return { error: `Couldn't build the grocery list: ${(e as Error).message}` };
  }
  const db = await getDb();
  // Making the list can take a while. If someone swapped a dinner meanwhile, this list is for the wrong meals:
  // don't approve it. (The check and the write happen under one lock, so nothing slips in between.)
  const locked = await updatePlanLocked(userId, planId, (row) => {
    if (row.status !== "draft" || row.archivedAt) return { error: "This week was changed while your list was being made. Refresh the page and look again." };
    if (JSON.stringify(row.days) !== JSON.stringify(plan.days)) return { error: "A dinner was changed while your list was being made. Look over the week once more, then tap the button again." };
    return { groceryList, status: "approved" as const, approvedAt: new Date() };
  });
  if (locked.error) return { error: locked.error };
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

/** This week's check-in, from "Plan my week". */
const WeekCheckIn = z.object({
  cookDays: z.array(z.number().int().min(0).max(6)).max(7),
  busyDays: z.array(z.number().int().min(0).max(6)).max(7),
  budget: z.number().min(10).max(5000).nullable(),
  useUp: z.string().max(300),
  craving: z.string().max(80),
  tryNew: z.boolean(),
  desserts: z.number().int().min(0).max(3).optional(),
  eating: z.array(z.object({ weekday: z.number().int().min(0).max(6), adults: z.number().int().min(0).max(30), kids: z.number().int().min(0).max(30) }).refine((e) => e.adults + e.kids >= 1)).max(7),
});

/**
 * A night's dinner sized for who's eating (null: the usual household). On a double-batch night only tonight's
 * batch changes; the leftovers night is still the usual table.
 */
function withEating(d: PlanDay, eating: { adults: number; kids: number } | null, settings: Settings): PlanDay {
  const before = dinnerServings(d.eating ?? settings);
  const after = dinnerServings(eating ?? settings);
  const batches = d.batches ?? 1;
  const perBatch = d.estimatedCost != null ? d.estimatedCost / batches : null;
  const cost = perBatch != null ? Math.round((perBatch * (batches - 1) + (perBatch * after) / before) * 100) / 100 : d.estimatedCost;
  return { ...d, eating, estimatedCost: cost };
}

/** A dinner's cost for whoever is at the table that night (the usual household when no one's set). */
function forTable(cost: number, eating: PlanDay["eating"], settings: Settings): number {
  if (!eating) return cost;
  return Math.round(((cost * dinnerServings(eating)) / dinnerServings(settings)) * 100) / 100;
}

/**
 * "Who's eating tonight?": a night with company, or someone away. Before the list is made, that night's dinner
 * (and its cost) is sized for them; null goes back to the usual household.
 */
export async function setEating(planId: string, dayIndex: number, eating: { adults: number; kids: number } | null): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !Number.isInteger(dayIndex)) return { error: "Day not found." };
  const { data: settings } = await getSettings(userId);
  const want = eating == null ? null : { adults: Math.round(Number(eating.adults)), kids: Math.round(Number(eating.kids)) };
  if (want && (!Number.isFinite(want.adults) || !Number.isFinite(want.kids) || want.adults < 0 || want.kids < 0 || want.adults + want.kids < 1 || want.adults > 30 || want.kids > 30)) {
    return { error: "Choose between 1 and 60 people." };
  }
  const usual = want && want.adults === settings.adults && want.kids === settings.kids;
  const r = await updatePlanLocked(userId, planId, (plan) => {
    if (plan.status !== "draft") return { error: "The grocery list is already made. Change who's eating before you approve the week." };
    const day = plan.days[dayIndex];
    if (!day) return { error: "Day not found." };
    if (!day.recipeId || day.leftoverOf || day.feast) return { error: "Only a night with a dinner to cook can change who's eating." };
    const days = plan.days.map((d, j) => (j === dayIndex ? withEating(d, usual || !want ? null : want, settings) : d));
    return { days, estimatedTotal: sumCosts(days) };
  });
  if (!r.error) revalidatePath("/");
  return r;
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

/** "Read my receipt": a photo of the receipt fills in what the week cost. */
export async function readReceiptTotal(planId: string, form: FormData): Promise<{ total?: number; saved?: number | null; error?: string }> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: "Week not found." };
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Take or choose a photo of the receipt." };
  // The AI takes images up to 5 MB once encoded (about a third bigger than the file).
  if (file.size > 3.7 * 1024 * 1024) return { error: "That photo is too big. Try a closer, smaller one (under about 3.5 MB)." };
  const plan = await getPlan(userId, planId);
  if (!plan || plan.status !== "approved" || plan.archivedAt) return { error: "Week not found." };
  if (!(await under("receipt", userId))) return { error: TOO_MANY };
  try {
    const read = await readReceipt(Buffer.from(await file.arrayBuffer()).toString("base64"), file.type);
    const total = usableTotal(read);
    if (total == null) return { error: read.isReceipt ? "We couldn't read the total clearly. Try a straighter, closer photo, or type it in." : "That doesn't look like a receipt." };
    const db = await getDb();
    await db.update(plans).set({ actualSpend: total }).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
    revalidatePath("/history");
    return { total, saved: read.saved != null && read.saved > 0 && read.saved < total * 2 ? read.saved : null };
  } catch (e) {
    // Our own messages are written for people; anything else (the AI or the database) isn't.
    const msg = (e as Error).message ?? "";
    return { error: /^(Reading receipts|Please use)/.test(msg) ? msg : "We couldn't read that receipt just now. Try again, or type the total." };
  }
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
  let days: PlanDay[] = dates.map((date) => {
    // Same weekday as before (a short "rest of this week" plan doesn't start on the shopping day).
    const d = source.days.find((x) => weekday(x.date) === weekday(date));
    const r = d?.recipeId ? live.get(d.recipeId) : undefined;
    // A leftovers night keeps pointing at its cooking night (same weekday in the new week).
    const origin = d?.leftoverOf ? source.days.find((x) => x.date === d.leftoverOf) : undefined;
    const at = origin ? dates.findIndex((x) => weekday(x) === weekday(origin.date)) : -1;
    // If the week now starts on a different day, a leftovers night could land before its cooking night: cook it fresh.
    const from = at >= 0 && dates[at] < date ? at : -1;
    return {
      date,
      recipeId: r ? r.id : null,
      recipeName: r ? r.name : null,
      estimatedCost: r && !d?.leftoverOf ? dinnerCost(r, settings, []).total : r ? 0 : null,
      reason: r ? (d?.leftoverOf ? `Leftovers from ${dayName(dates[from] ?? date)}: cook once, eat twice` : `Reused from week of ${source.weekOf}`) : "No-cook night",
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
    budget: settings.weeklyBudget,
  });
  revalidatePath("/");
}
