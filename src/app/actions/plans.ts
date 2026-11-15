"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { plans, recipes } from "@/db/schema";
import { activePlans, getPlan, getSettings, myRecipes, recipesByIds } from "@/lib/data";
import { buildGroceryList } from "@/lib/grocery";
import { planWeek, sumCosts } from "@/lib/planner";
import { recipeSales, scanSales, type SaleScan } from "@/lib/sales";
import type { SaleCheck, SaleItem } from "@/lib/types";
import { addDays, upcomingWeekStart, weekDates } from "@/lib/week";

export type ActionResult = { error?: string } | void;

async function archiveOthersForWeek(userId: string, weekOf: string, keepId?: string) {
  const db = await getDb();
  const conds = [eq(plans.userId, userId), eq(plans.weekOf, weekOf), isNull(plans.archivedAt)];
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
  const windowStart = addDays(weekStart, -7 * settings.noRepeatWeeks);
  const recent = (await activePlans(userId)).filter(
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

  let result;
  try {
    result = await planWeek({
      settings, weekStart, recipes: recipeList, recentPlans: recent,
      saleItems: sales, storePrices: scan.status === "ok" ? scan.prices : [],
    });
  } catch (e) {
    return { error: `The planner hit a problem: ${(e as Error).message}` };
  }

  const db = await getDb();
  await archiveOthersForWeek(userId, weekStart);
  await db.insert(plans).values({
    userId,
    weekOf: weekStart,
    status: "draft",
    days: result.days,
    saleItems: sales,
    saleCheck,
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
    plan.days[dayIndex] = { ...day, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [] };
  } else {
    const [recipe] = await recipesByIds(userId, [recipeId]);
    if (!recipe) return { error: "Recipe not found." };
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
      alternatives: [...previous, ...day.alternatives.filter((a) => a.recipeId !== recipeId)].slice(0, 3),
    };
  }
  const db = await getDb();
  await db
    .update(plans)
    .set({ days: plan.days, estimatedTotal: sumCosts(plan.days) })
    .where(eq(plans.id, planId));
  revalidatePath("/");
}

/** The human gate: lock the plan and build the grocery list. Cart fill comes later; never checkout. */
export async function approvePlan(planId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const plan = await getPlan(userId, planId);
  if (!plan) return { error: "Plan not found." };
  if (plan.status === "approved") return;
  const { data: settings } = await getSettings(userId);
  const ids = plan.days.map((d) => d.recipeId).filter((x): x is string => !!x);
  const chosen = await recipesByIds(userId, ids);
  let groceryList;
  try {
    const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
    groceryList = await buildGroceryList(chosen, settings, sales);
  } catch (e) {
    return { error: `Couldn't build the grocery list: ${(e as Error).message}` };
  }
  const db = await getDb();
  await db
    .update(plans)
    .set({ status: "approved", approvedAt: new Date(), groceryList })
    .where(eq(plans.id, planId));
  revalidatePath("/");
  revalidatePath("/history");
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
  const live = new Set((await myRecipes(userId)).map((r) => r.id));
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
