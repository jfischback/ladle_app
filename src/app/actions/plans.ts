"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { cooks, foundRecipes, plans, recipes } from "@/db/schema";
import { activePlans, getPlan, getSettings, myRecipes, recipesByIds } from "@/lib/data";
import { adoptFoundRecipe, refreshCooks } from "@/lib/cooks";
import { ruleProblems } from "@/lib/diet";
import { buildGroceryList, saleNote } from "@/lib/grocery";
import { stapleTerm, staplesTotal } from "@/lib/staples";
import { FOUND_PREFIX, planWeek, sumCosts, type NewRecipeOption } from "@/lib/planner";
import { recipeSales, scanSales, type SaleScan } from "@/lib/sales";
import { leftoverNotes, planLunches } from "@/lib/lunch";
import type { PlanDay, SaleCheck, SaleItem, StapleLine } from "@/lib/types";
import type { Settings } from "@/lib/settings";
import { addDays, upcomingWeekStart, weekDates } from "@/lib/week";

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
  const { data: settings } = await getSettings(userId);
  const weekStart = upcomingWeekStart(settings.shoppingDay);
  const recipeList = await myRecipes(userId);
  if (recipeList.length < settings.dinnersPerWeek) {
    return { error: `You need at least ${settings.dinnersPerWeek} dinners in My Recipes to plan a week.` };
  }
  const fitting = recipeList.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && !(r.rating != null && r.rating <= 2)).length;
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
  let scan: SaleScan;
  try {
    scan = await scanSales(recipeList, settings);
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

  let result;
  try {
    result = await planWeek({
      settings, weekStart, recipes: recipeList, recentPlans: recent, history: allPlans.filter((p) => p.status === "approved"),
      saleItems: sales, storePrices: scan.status === "ok" ? scan.prices : [], newRecipes,
      staplesCost: staplesTotal(staples).total,
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
  result.estimatedTotal = sumCosts(result.days);
  result.days = await withLunches(userId, result.days, settings, sales);

  await archiveOthersForWeek(userId, weekStart);
  await db.insert(plans).values({
    userId,
    weekOf: weekStart,
    status: "draft",
    days: result.days,
    saleItems: sales,
    saleCheck,
    staples,
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

  if (recipeId === null) {
    plan.days[dayIndex] = { ...day, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [], fromCook: null };
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
      estimatedCost: alt?.estimatedCost ?? null,
      reason: alt?.reason ?? "Your pick",
      saleItems: recipeSales(recipe, plan.saleItems.filter((x): x is SaleItem => typeof x !== "string")),
      fromCook: recipe.trial ? recipe.creditName : null,
      alternatives: [...previous, ...day.alternatives.filter((a) => a.recipeId !== recipeId)].slice(0, 3),
    };
  }
  // Lunches depend on the night before, so re-plan them after any dinner change.
  const { data: settings } = await getSettings(userId);
  plan.days = await withLunches(userId, plan.days, settings, plan.saleItems.filter((x): x is SaleItem => typeof x !== "string"));
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
  const [dinnerRows, lunchPool] = await Promise.all([recipesByIds(userId, dinnerIds), myRecipes(userId, "lunch")]);
  return planLunches(days, settings, new Map(dinnerRows.map((r) => [r.id, r])), lunchPool, sales);
}

/** The human gate: lock the plan and build the grocery list. Cart fill comes later; never checkout. */
export async function approvePlan(planId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const plan = await getPlan(userId, planId);
  if (!plan) return { error: "Plan not found." };
  if (plan.status === "approved") return;
  if (plan.archivedAt) return { error: "This week was replaced. Refresh the page to see the current plan." };
  const { data: settings } = await getSettings(userId);
  const ids = plan.days.map((d) => d.recipeId).filter((x): x is string => !!x);
  // Lunch recipes need shopping too (leftover lunches are covered by cooking extra at dinner).
  const lunchIds = plan.days.map((d) => (d.lunch?.kind === "recipe" ? d.lunch.recipeId : null)).filter((x): x is string => !!x);
  const chosen = await recipesByIds(userId, [...new Set([...ids, ...lunchIds])]);
  let groceryList;
  try {
    const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
    groceryList = await buildGroceryList(chosen, settings, sales, leftoverNotes(plan.days));
    // Weekly staples get their own section, with this week's sale prices where we found them.
    const snap = new Map((plan.staples ?? []).map((l) => [stapleTerm(l.item), l]));
    const items = settings.staples.filter((x) => x.active).map((x) => {
      const sale = snap.get(stapleTerm(x.item))?.sale;
      return { item: x.item, quantity: x.quantity, note: sale ? saleNote(sale) : "", forRecipes: [] };
    });
    if (items.length) groceryList = { ...groceryList, sections: [{ name: "Weekly staples", items }, ...groceryList.sections] };
  } catch (e) {
    return { error: `Couldn't build the grocery list: ${(e as Error).message}` };
  }
  const db = await getDb();
  await db
    .update(plans)
    .set({ status: "approved", approvedAt: new Date(), groceryList })
    .where(and(eq(plans.id, planId), eq(plans.status, "draft"), isNull(plans.archivedAt)));
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
export async function rateCookedDinner(planId: string, dayIndex: number, stars: number | null) {
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
  // Only recipes still in the box that fit today's food rules.
  const live = new Set((await myRecipes(userId)).filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length).map((r) => r.id));
  const days = dates.map((date, i) => {
    const d = source.days[i];
    const ok = d?.recipeId && live.has(d.recipeId);
    return {
      date,
      recipeId: ok ? d.recipeId : null,
      recipeName: ok ? d.recipeName : null,
      estimatedCost: ok ? d.estimatedCost : null,
      reason: ok ? `Reused from week of ${source.weekOf}` : "No-cook night",
      saleItems: [],
      alternatives: [],
    };
  });
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
