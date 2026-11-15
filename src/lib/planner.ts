import "server-only";
import { z } from "zod";
import type { Recipe, Plan } from "@/db/schema";
import { MOTIVATIONS, type Settings } from "./settings";
import type { PlanDay } from "./types";
import { askClaude, claudeEnabled } from "./claude";
import { dayName, weekDates, weekday } from "./week";
import { ruleProblems, rulesSummary } from "./diet";
import { recipeSales, type SaleItem, type StorePrice } from "./sales";
import type { Ingredient } from "./types";

/** A recipe from a followed cook that isn't in the user's list yet. Planned days point at it as "found:<id>". */
export type NewRecipeOption = { foundId: string; title: string; cookName: string; ingredients: Ingredient[]; totalMinutes: number | null };
export const FOUND_PREFIX = "found:";

export type PlanResult = {
  days: PlanDay[];
  summary: string;
  estimatedTotal: number | null;
  source: "claude" | "basic";
};

const PlanSchema = z.object({
  summary: z.string().describe("One or two plain sentences about the week, e.g. what's on sale and how the plan uses it."),
  days: z
    .array(
      z.object({
        date: z.string().describe("YYYY-MM-DD, one entry for each of the seven dates given"),
        recipeKey: z.string().nullable().describe("Key of the chosen recipe, or null for a no-cook night"),
        reason: z.string().describe("One short line on why this pick, e.g. 'Beef is 30% off, so two beef nights'"),
        estimatedCost: z.number().nullable().describe("Estimated grocery cost in USD for this dinner for this household"),
        saleItems: z.array(z.string()).describe("Sale items this dinner uses, using the exact 'item' names from saleItems; empty if none"),
        alternatives: z
          .array(
            z.object({
              recipeKey: z.string(),
              estimatedCost: z.number().nullable(),
              reason: z.string(),
            }),
          )
          .describe("Two or three swap options for this night, empty for a no-cook night"),
      }),
    )
    .describe("Exactly seven entries, in date order"),
  estimatedTotal: z.number().describe("Estimated total cart cost in USD for the week's dinners"),
});

const SYSTEM = `You are the weekly dinner planner inside Ladle, a meal-planning app for busy families who shop at Fry's (Kroger) in the Phoenix area.

You receive one JSON package: the household's settings and priorities, their approved recipe list, this week's sale items at their store (may be empty), and recent weeks' dinners. Pick the week's dinners following these rules exactly. Do not make up rules beyond these.

Rules:
- Return all seven dates. Only the dates marked cook: true get a recipe (one each); every other date is a no-cook night (recipeKey null, reason like "Leftovers night").
- foodRules are strict (allergies, diets, "no bones", foods they won't eat). The recipe lists were already checked, but if a recipe still looks like it breaks a rule, don't pick it.
- Only use recipe keys from the recipe list. Never pick the same recipe twice in one week.
- Never pick a recipe that appears in the recent weeks' dinners (the no-repeat window is already applied to that list).
- Never pick a recipe rated 1 or 2 stars. Favor higher-rated recipes. Unrated recipes are fine.
- Plan around what's on sale: an item counts as on sale only if it is at least saleThresholdPct percent off regular price. Lean on recipes that use sale items.
- Weigh choices by the household's ranked priorities: "save money" leans on sale items and cheaper dinners; "eat healthier" leans on protein and vegetables; "try new things" leans on recipes not cooked recently or never cooked.
- If favorQuickWeeknights is true, prefer quicker recipes (shorter totalMinutes, "quick" tag) Monday through Thursday.
- Budget: keep the week's estimated total near weeklyBudget. If budgetMode is "hard", the total must not go over it. If "target", it may go slightly over when that keeps a good week.
- If a recipe has a prepAhead note, avoid putting it on the first day of the week (there is no day before to prep).
- Costs: estimate what the ingredients for each dinner cost for this household's size. When an ingredient is in storePrices, use that real shelf price at their Fry's (sale prices are already applied there); otherwise estimate typical Phoenix-area Fry's prices. Pantry staples they likely have count as zero. These are labeled estimates in the app, so be reasonable rather than precise.
- When a reason mentions a sale, name the item and the discount, e.g. "Chicken thighs are 35% off".
- Each pick gets a one-line reason a tired parent can read in two seconds.
- Give two or three alternatives for each cooking night, from the same recipe list, not already used that week and following the same rules.
- newRecipes are new dinners from food creators the family follows. Use at most newRecipesPerWeek of them (their keys start with "n"), and only on a night that suits them. Prefer ones that use sale items. Their reason must start with "New from <cookName>" and say why, e.g. "New from Pinch of Yum: ground beef is 30% off". Never use newRecipes as alternatives.`;

export async function planWeek(input: {
  settings: Settings;
  weekStart: string;
  recipes: Recipe[];
  recentPlans: Plan[];
  saleItems: SaleItem[];
  storePrices?: StorePrice[];
  newRecipes?: NewRecipeOption[];
}): Promise<PlanResult> {
  const { settings, weekStart } = input;
  const dates = weekDates(weekStart);

  const recentRecipeIds = new Set(
    input.recentPlans.flatMap((p) => p.days.map((d) => d.recipeId).filter(Boolean) as string[]),
  );
  // Section 5: skip 1-2 star meals; no-repeat window.
  // Food rules are hard: a recipe that breaks one is never planned.
  const allowed = input.recipes.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes).length);
  const eligible = allowed.filter((r) => !(r.rating != null && r.rating <= 2) && !recentRecipeIds.has(r.id));
  const pool = eligible.length >= settings.dinnersPerWeek ? eligible : allowed.filter((r) => !(r.rating != null && r.rating <= 2));
  const cookDays = new Set(settings.cookDays);

  const newOptions = settings.newRecipesPerWeek > 0 ? (input.newRecipes ?? []).filter((n) => !ruleProblems(n, settings.foodRules, settings.dislikes).length) : [];
  if (!claudeEnabled()) return basicPlan(dates, pool, settings, input.saleItems, newOptions);

  const keyed = pool.map((r, i) => ({ key: `r${i + 1}`, recipe: r }));
  const byKey = new Map(keyed.map((k) => [k.key, k.recipe]));
  const newKeyed = newOptions.map((n, i) => ({ key: `n${i + 1}`, option: n }));
  const byNewKey = new Map(newKeyed.map((k) => [k.key, k.option]));

  const pkg = {
    week: dates.map((d) => ({ date: d, day: dayName(d), cook: cookDays.has(weekday(d)) })),
    foodRules: rulesSummary(settings.foodRules, settings.dislikes) || "none",
    household: {
      adults: settings.adults,
      kids: settings.kids,
      baby: settings.hasBaby ? { ageMonths: settings.babyAgeMonths } : null,
    },
    priorities: settings.motivation.map((m) => MOTIVATIONS[m]),
    dinnersPerWeek: settings.dinnersPerWeek,
    weeklyBudget: settings.weeklyBudget,
    budgetMode: settings.budgetMode,
    favorQuickWeeknights: settings.favorQuickWeeknights,
    saleThresholdPct: settings.saleThresholdPct,
    store: settings.storeName || "Fry's",
    saleItems: input.saleItems,
    salePricesAvailable: input.saleItems.length > 0,
    storePrices: input.storePrices ?? [],
    recentDinners: input.recentPlans.map((p) => ({
      weekOf: p.weekOf,
      dinners: p.days.map((d) => d.recipeName).filter(Boolean),
    })),
    recipes: keyed.map(({ key, recipe: r }) => ({
      key,
      name: r.name,
      protein: r.protein,
      totalMinutes: r.totalMinutes,
      servings: r.servings,
      tags: r.tags,
      rating: r.rating,
      ease: r.ease,
      prepAhead: r.prepAhead || null,
      ingredients: r.ingredients.map((i) => [i.amount, i.unit, i.item].filter(Boolean).join(" ")),
    })),
    newRecipesPerWeek: newOptions.length ? settings.newRecipesPerWeek : 0,
    newRecipes: newKeyed.map(({ key, option: n }) => ({
      key,
      name: n.title,
      cookName: n.cookName,
      totalMinutes: n.totalMinutes,
      ingredients: n.ingredients.map((i) => [i.amount, i.unit, i.item].filter(Boolean).join(" ")),
    })),
  };

  const out = await askClaude({ system: SYSTEM, content: JSON.stringify(pkg), schema: PlanSchema });

  const used = new Set<string>();
  let newCount = 0;
  const days: PlanDay[] = dates.map((date) => {
    // Nights they didn't pick are always nights off, whatever came back.
    if (!cookDays.has(weekday(date))) return { date, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [], alternatives: [] };
    const d = out.days.find((x) => x.date === date);
    const option = d?.recipeKey ? byNewKey.get(d.recipeKey) : undefined;
    if (option && !used.has(option.foundId) && newCount < settings.newRecipesPerWeek) {
      used.add(option.foundId);
      newCount++;
      return newDay(date, option, input.saleItems, d?.reason, d?.estimatedCost ?? null, (d?.alternatives ?? [])
        .map((a) => byKey.get(a.recipeKey))
        .filter((r): r is Recipe => !!r)
        .map((r) => ({ recipeId: r.id, recipeName: r.name, estimatedCost: null, reason: "One of your recipes" })));
    }
    const recipe = d?.recipeKey ? byKey.get(d.recipeKey) : undefined;
    const valid = recipe && !used.has(recipe.id);
    if (valid) used.add(recipe.id);
    return {
      date,
      recipeId: valid ? recipe.id : null,
      recipeName: valid ? recipe.name : null,
      estimatedCost: valid ? (d?.estimatedCost ?? null) : null,
      reason: valid ? (d?.reason ?? "") : d?.recipeKey ? "No-cook night" : (d?.reason ?? "No-cook night"),
      saleItems: valid ? daySales(recipe, d?.saleItems ?? [], input.saleItems) : [],
      alternatives: (d?.alternatives ?? [])
        .map((a) => {
          const r = byKey.get(a.recipeKey);
          return r ? { recipeId: r.id, recipeName: r.name, estimatedCost: a.estimatedCost, reason: a.reason } : null;
        })
        .filter((a): a is NonNullable<typeof a> => !!a),
    };
  });

  return { days, summary: out.summary, estimatedTotal: sumCosts(days), source: "claude" };
}

/** A planned night that uses a new recipe from a followed cook. */
function newDay(date: string, n: NewRecipeOption, sales: SaleItem[], reason: string | undefined, cost: number | null, alternatives: PlanDay["alternatives"]): PlanDay {
  const onSale = recipeSales(n, sales);
  let why = reason?.trim();
  if (!why || !why.toLowerCase().startsWith("new from")) {
    const top = sales.find((s) => s.item === onSale[0]);
    why = top ? `New from ${n.cookName}: ${top.item} ${/s$/.test(top.item) ? "are" : "is"} ${top.pctOff}% off` : `New from ${n.cookName}, something new to try`;
  }
  return {
    date,
    recipeId: `${FOUND_PREFIX}${n.foundId}`,
    recipeName: n.title,
    estimatedCost: cost,
    reason: why,
    saleItems: onSale,
    alternatives,
    fromCook: n.cookName,
  };
}

/** The sale items a dinner really uses: what the recipe's ingredients match, plus any valid ones Claude named. */
function daySales(recipe: Recipe, named: string[], sales: SaleItem[]): string[] {
  const known = new Set(sales.map((s) => s.item));
  return [...new Set([...recipeSales(recipe, sales), ...named.filter((n) => known.has(n))])];
}

/** Used when no Claude key is configured: random picks that respect the hard rules, leaning on sale items, no costs. */
function basicPlan(dates: string[], pool: Recipe[], settings: Settings, sales: SaleItem[], newOptions: NewRecipeOption[]): PlanResult {
  // Shuffle, then let recipes that use more sale items float to the top.
  const shuffled = [...pool]
    .map((r) => ({ r, score: recipeSales(r, sales).length + Math.random() * 0.9 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  const picks = shuffled.slice(0, settings.dinnersPerWeek);
  const rest = shuffled.slice(settings.dinnersPerWeek);
  // Cook on the nights they picked.
  const cookIdx = new Set(dates.map((d, i) => (settings.cookDays.includes(weekday(d)) ? i : -1)).filter((i) => i >= 0));
  let p = 0;
  const days: PlanDay[] = dates.map((date, i) => {
    const r = cookIdx.has(i) ? picks[p++] : undefined;
    return {
      date,
      recipeId: r?.id ?? null,
      recipeName: r?.name ?? null,
      estimatedCost: null,
      reason: r ? saleReason(r, sales) : "No-cook night",
      saleItems: r ? recipeSales(r, sales) : [],
      alternatives: r ? rest.slice((i * 3) % Math.max(rest.length, 1)).slice(0, 3).map((a) => ({
        recipeId: a.id,
        recipeName: a.name,
        estimatedCost: null,
        reason: "From your recipes",
      })) : [],
    };
  });
  // Swap in new recipes from followed cooks for the last cooking nights, best sale matches first.
  const newPicks = [...newOptions]
    .sort((a, b) => recipeSales(b, sales).length - recipeSales(a, sales).length)
    .slice(0, settings.newRecipesPerWeek);
  const cookingDays = days.map((d, i) => (d.recipeId ? i : -1)).filter((i) => i >= 0).reverse();
  newPicks.forEach((n, k) => {
    const i = cookingDays[k];
    if (i == null) return;
    days[i] = newDay(days[i].date, n, sales, undefined, null, days[i].recipeId ? [{ recipeId: days[i].recipeId!, recipeName: days[i].recipeName!, estimatedCost: null, reason: "One of your recipes" }, ...days[i].alternatives].slice(0, 3) : []);
  });
  return {
    days,
    summary: sales.length
      ? `Picked from your recipes, favoring dinners that use this week's ${sales.length} sale item${sales.length === 1 ? "" : "s"}.`
      : "Basic planner (Claude isn't connected yet): random picks from your recipes, skipping recent repeats and low ratings.",
    estimatedTotal: null,
    source: "basic",
  };
}

function saleReason(r: Recipe, sales: SaleItem[]): string {
  const used = recipeSales(r, sales);
  if (!used.length) return "Picked from your recipes";
  const top = sales.find((s) => s.item === used[0])!;
  const name = top.item.charAt(0).toUpperCase() + top.item.slice(1);
  return used.length > 1 ? `${name} and ${used.length - 1} more on sale` : `${name} ${/s$/.test(top.item) ? "are" : "is"} ${top.pctOff}% off`;
}

export function sumCosts(days: PlanDay[]): number | null {
  const costs = days.filter((d) => d.recipeId).map((d) => d.estimatedCost);
  if (!costs.length || costs.some((c) => c == null)) return costs.some((c) => c != null) ? costs.reduce<number>((a, c) => a + (c ?? 0), 0) : null;
  return costs.reduce<number>((a, c) => a + (c ?? 0), 0);
}
