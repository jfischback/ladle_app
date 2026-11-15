import "server-only";
import { z } from "zod";
import type { Recipe, Plan } from "@/db/schema";
import { MOTIVATIONS, type Settings } from "./settings";
import type { PlanDay } from "./types";
import { askClaude, claudeEnabled } from "./claude";
import { dayName, weekDates } from "./week";
import { recipeSales, type SaleItem, type StorePrice } from "./sales";

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
- Return all seven dates. Exactly "dinnersPerWeek" of them get a recipe; the rest are no-cook nights (recipeKey null, reason like "Leftovers night").
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
- Give two or three alternatives for each cooking night, from the same recipe list, not already used that week and following the same rules.`;

export async function planWeek(input: {
  settings: Settings;
  weekStart: string;
  recipes: Recipe[];
  recentPlans: Plan[];
  saleItems: SaleItem[];
  storePrices?: StorePrice[];
}): Promise<PlanResult> {
  const { settings, weekStart } = input;
  const dates = weekDates(weekStart);

  const recentRecipeIds = new Set(
    input.recentPlans.flatMap((p) => p.days.map((d) => d.recipeId).filter(Boolean) as string[]),
  );
  // Section 5: skip 1-2 star meals; no-repeat window.
  const eligible = input.recipes.filter((r) => !(r.rating != null && r.rating <= 2) && !recentRecipeIds.has(r.id));
  const pool = eligible.length >= settings.dinnersPerWeek ? eligible : input.recipes.filter((r) => !(r.rating != null && r.rating <= 2));

  if (!claudeEnabled()) return basicPlan(dates, pool, settings, input.saleItems);

  const keyed = pool.map((r, i) => ({ key: `r${i + 1}`, recipe: r }));
  const byKey = new Map(keyed.map((k) => [k.key, k.recipe]));

  const pkg = {
    week: dates.map((d) => ({ date: d, day: dayName(d) })),
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
  };

  const out = await askClaude({ system: SYSTEM, content: JSON.stringify(pkg), schema: PlanSchema });

  const used = new Set<string>();
  const days: PlanDay[] = dates.map((date) => {
    const d = out.days.find((x) => x.date === date);
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

/** The sale items a dinner really uses: what the recipe's ingredients match, plus any valid ones Claude named. */
function daySales(recipe: Recipe, named: string[], sales: SaleItem[]): string[] {
  const known = new Set(sales.map((s) => s.item));
  return [...new Set([...recipeSales(recipe, sales), ...named.filter((n) => known.has(n))])];
}

/** Used when no Claude key is configured: random picks that respect the hard rules, leaning on sale items, no costs. */
function basicPlan(dates: string[], pool: Recipe[], settings: Settings, sales: SaleItem[]): PlanResult {
  // Shuffle, then let recipes that use more sale items float to the top.
  const shuffled = [...pool]
    .map((r) => ({ r, score: recipeSales(r, sales).length + Math.random() * 0.9 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  const picks = shuffled.slice(0, settings.dinnersPerWeek);
  const rest = shuffled.slice(settings.dinnersPerWeek);
  // Spread cooking nights from the start of the week.
  const cookIdx = new Set(
    Array.from({ length: Math.min(picks.length, 7) }, (_, i) => Math.round((i * 7) / Math.max(picks.length, 1))),
  );
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
