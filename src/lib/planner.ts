import "server-only";
import { z } from "zod";
import type { Recipe, Plan } from "@/db/schema";
import { MOTIVATIONS, type Settings } from "./settings";
import type { PlanDay } from "./types";
import { askClaude, claudeEnabled } from "./claude";
import { addDays, dayName, weekDates, weekday } from "./week";
import { ruleProblems, rulesSummary } from "./diet";
import { isPerishable, proteinGroup, type ProteinGroup } from "./protein";
import { leftoverKind } from "./leftovers";
import { holidayOn } from "./holidays";
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
- Budget: weeklyBudget covers the dinners plus the household's weekly staples (staplesCost, already known). Keep the dinners' estimated total near weeklyBudget minus staplesCost. If budgetMode is "hard", the total must not go over it. If "target", it may go slightly over when that keeps a good week.
- If a recipe has a prepAhead note, avoid putting it on the first day of the week (there is no day before to prep).
- Busy nights (busy.maxMinutes) need a dinner with totalMinutes at or under that limit. Say so in the reason, e.g. "Quick for soccer night: 25 minutes".
- Variety: use the same mainProtein on at most maxSameProteinPerWeek nights, and never on two nights in a row (Vegetarian doesn't count). Exception: a protein in saleProteins (this week's protein deal) may go up to two nights over the cap; build the week around it.
- Leftovers: when lunchNext is true, prefer a dinner whose makesLeftovers is true (tomorrow's lunch is the leftovers). Dinners with makesLeftovers false are one night only.
- If beforeHoliday is true, don't pick a dinner whose mainProtein is in holidayNoReheat (everyone eats its leftovers tomorrow).
- Freshness: Fish and Seafood dinners go in the first three days after shopping (daysAfterShopping 0-2).
- Bring back favorites: a recipe rated 4 or 5 with lastCookedWeeksAgo of 4 or more (or never planned) deserves a spot; mention it, e.g. "A favorite you haven't had in 5 weeks".
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
  /** All approved weeks, to bring back favorites that haven't been cooked in a while. */
  history?: Plan[];
  saleItems: SaleItem[];
  storePrices?: StorePrice[];
  staplesCost?: number;
  newRecipes?: NewRecipeOption[];
}): Promise<PlanResult> {
  const { settings, weekStart } = input;
  const dates = weekDates(weekStart);

  const recentRecipeIds = new Set(
    input.recentPlans.flatMap((p) => p.days.map((d) => d.recipeId).filter(Boolean) as string[]),
  );
  // Section 5: skip 1-2 star meals; no-repeat window.
  // Food rules are hard: a recipe that breaks one is never planned.
  const allowed = input.recipes.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length);
  const eligible = allowed.filter((r) => !(r.rating != null && r.rating <= 2) && !recentRecipeIds.has(r.id));
  const pool = eligible.length >= settings.dinnersPerWeek ? eligible : allowed.filter((r) => !(r.rating != null && r.rating <= 2));
  const cookDays = new Set(settings.cookDays);

  const newOptions = settings.newRecipesPerWeek > 0 ? (input.newRecipes ?? []).filter((n) => !ruleProblems(n, settings.foodRules, settings.dislikes, settings.allowAnyway).length) : [];
  const lastCooked = lastCookedWeeks(input.history ?? input.recentPlans, weekStart);
  if (!claudeEnabled()) return basicPlan(dates, pool, settings, input.saleItems, newOptions, lastCooked);

  const keyed = pool.map((r, i) => ({ key: `r${i + 1}`, recipe: r }));
  const byKey = new Map(keyed.map((k) => [k.key, k.recipe]));
  const newKeyed = newOptions.map((n, i) => ({ key: `n${i + 1}`, option: n }));
  const byNewKey = new Map(newKeyed.map((k) => [k.key, k.option]));

  const pkg = {
    week: dates.map((d, i) => ({
      date: d,
      day: dayName(d),
      cook: cookDays.has(weekday(d)),
      busy: settings.busyDays.includes(weekday(d)) ? { maxMinutes: settings.busyMaxMinutes } : false,
      daysAfterShopping: i,
      lunchNext: settings.lunchDays.includes(weekday(addDays(d, 1))),
      beforeHoliday: !!holidayOn(addDays(d, 1)) && settings.holidayEveryoneHome,
      holiday: holidayOn(d),
    })),
    maxSameProteinPerWeek: settings.maxSameProtein,
    foodRules: rulesSummary(settings.foodRules, settings.dislikes, settings.allowAnyway) || "none",
    household: {
      adults: settings.adults,
      kids: settings.kids,
      baby: settings.hasBaby ? { ageMonths: settings.babyAgeMonths } : null,
    },
    priorities: settings.motivation.map((m) => MOTIVATIONS[m]),
    dinnersPerWeek: settings.dinnersPerWeek,
    weeklyBudget: settings.weeklyBudget,
    staplesCost: Math.round(input.staplesCost ?? 0),
    budgetMode: settings.budgetMode,
    favorQuickWeeknights: settings.favorQuickWeeknights,
    saleThresholdPct: settings.saleThresholdPct,
    store: settings.storeName || "Fry's",
    saleItems: input.saleItems,
    saleProteins: [...saleProteinsOf(input.saleItems)],
    holidayNoReheat: settings.holidayNoReheat,
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
      mainProtein: proteinGroup(r),
      makesLeftovers: leftoverKind(r) === "ok",
      lastCookedWeeksAgo: lastCooked.get(r.id) ?? null,
      ingredients: r.ingredients.map((i) => [i.amount, i.unit, i.item].filter(Boolean).join(" ")),
    })),
    newRecipesPerWeek: newOptions.length ? settings.newRecipesPerWeek : 0,
    newRecipes: newKeyed.map(({ key, option: n }) => ({
      key,
      name: n.title,
      cookName: n.cookName,
      mainProtein: proteinGroup({ title: n.title, ingredients: n.ingredients }),
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

  const checked = enforceRules(days, dates, pool, settings, input.saleItems, lastCooked, newOptions);
  return { days: checked, summary: out.summary, estimatedTotal: sumCosts(checked), source: "claude" };
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

// ---------- rules every plan must follow (shared by the basic planner and the check on Claude's plan) ----------

type Candidate = {
  leftovers: boolean; // makes good leftovers for tomorrow's lunch
  key: string; // recipe id, or found:<id> for a new recipe from a followed cook
  name: string;
  minutes: number | null;
  protein: ProteinGroup;
  ingredients: Recipe["ingredients"];
  rating: number | null;
  weeksSince: number | null; // weeks since it was last cooked, if ever
  isNew: NewRecipeOption | null;
  recipe: Recipe | null;
};

type Slot = {
  index: number;
  date: string;
  busy: boolean;
  daysAfterShopping: number;
  lunchNext: boolean; // someone eats lunch at home tomorrow, so leftovers help
  beforeHoliday: boolean; // tomorrow is a federal holiday and everyone's home for lunch
  saleProteins: Set<ProteinGroup>; // proteins with a real deal this week (they may go over the weekly cap)
};

const toCandidate = (r: Recipe, lastCooked: Map<string, number>): Candidate => ({
  key: r.id, name: r.name, minutes: r.totalMinutes, protein: proteinGroup(r), ingredients: r.ingredients, leftovers: leftoverKind(r) === "ok",
  rating: r.rating, weeksSince: lastCooked.get(r.id) ?? null, isNew: null, recipe: r,
});
const newCandidate = (n: NewRecipeOption): Candidate => ({
  key: `${FOUND_PREFIX}${n.foundId}`, name: n.title, minutes: n.totalMinutes, protein: proteinGroup({ title: n.title, ingredients: n.ingredients }),
  leftovers: leftoverKind({ title: n.title, ingredients: n.ingredients }) === "ok",
  ingredients: n.ingredients, rating: null, weeksSince: null, isNew: n, recipe: null,
});

/**
 * Does this dinner fit this night, given what's already planned? `relax` loosens the softer rules when a week
 * can't be filled otherwise: 1 = allow the same protein two nights running, 2 = allow going over the protein cap,
 * 3 = allow a slow dinner on a busy night. Food rules are applied before this and never relaxed.
 */
function fitsNight(c: Candidate, slot: Slot, planned: { slot: Slot; c: Candidate }[], settings: Settings, relax = 0): boolean {
  if (planned.some((p) => p.c.key === c.key)) return false;
  if (relax < 3 && slot.busy && c.minutes != null && c.minutes > settings.busyMaxMinutes) return false;
  // The week's protein deal may go over the cap (beef on sale → more beef nights), up to two extra nights.
  const cap = settings.maxSameProtein + (slot.saleProteins.has(c.protein) ? 2 : 0);
  if (relax < 2 && c.protein !== "Vegetarian" && planned.filter((p) => p.c.protein === c.protein).length >= cap) return false;
  // Before a holiday everyone eats tomorrow's leftovers; skip proteins someone won't eat reheated.
  if (relax < 3 && slot.beforeHoliday && c.leftovers && settings.holidayNoReheat.includes(c.protein)) return false;
  if (relax < 1) {
    const neighbors = planned.filter((p) => Math.abs(p.slot.index - slot.index) === 1);
    if (c.protein !== "Vegetarian" && neighbors.some((p) => p.c.protein === c.protein)) return false;
  }
  if (isPerishable(c.protein) && slot.daysAfterShopping > 2 && relax < 2) return false; // fish is best fresh
  return true;
}

function score(c: Candidate, slot: Slot, sales: SaleItem[]): number {
  let s = recipeSales(c, sales).length * 2;
  if (c.rating === 5) s += 2;
  else if (c.rating === 4) s += 1;
  else if (c.rating == null) s += 0.3;
  if ((c.rating ?? 0) >= 4 && c.weeksSince != null && c.weeksSince >= 4) s += 1.5; // a favorite that's due
  if (c.isNew) s += 0.8;
  if (slot.lunchNext && c.leftovers) s += 0.8; // tomorrow's lunch is covered
  if (slot.saleProteins.has(c.protein)) s += 0.7; // build the week around the protein deal
  if (slot.busy && c.minutes != null) s += Math.max(0, (30 - c.minutes) / 60); // a little nudge to the quickest
  return s + Math.random() * 2.5; // plenty of shuffle so weeks don't feel the same
}

/** Proteins with a real deal this week. Burger patties and hot dogs don't count as the week's protein deal. */
export function saleProteinsOf(sales: SaleItem[]): Set<ProteinGroup> {
  const out = new Set<ProteinGroup>();
  for (const s of sales) {
    if (/patt(y|ies)|hot dogs?|burgers?|franks?|deli|lunch meat|jerky|broth|stock/i.test(`${s.item} ${s.product}`)) continue;
    const g = proteinGroup({ title: s.item, ingredients: [] });
    if (g !== "Vegetarian") out.add(g);
  }
  return out;
}

function slotsFor(dates: string[], settings: Settings, sales: SaleItem[]): Slot[] {
  const saleProteins = saleProteinsOf(sales);
  return dates
    .map((date, index) => {
      const tomorrow = addDays(date, 1);
      const holidayTomorrow = !!holidayOn(tomorrow) && weekday(tomorrow) >= 1 && weekday(tomorrow) <= 5;
      return {
        index, date, saleProteins,
        busy: settings.busyDays.includes(weekday(date)),
        daysAfterShopping: index,
        lunchNext: settings.lunchDays.includes(weekday(tomorrow)) || (holidayTomorrow && settings.holidayEveryoneHome),
        beforeHoliday: holidayTomorrow && settings.holidayEveryoneHome,
      };
    })
    .filter((s) => settings.cookDays.includes(weekday(s.date)));
}

/** Weeks since each recipe was last on an approved plan. */
export function lastCookedWeeks(history: Plan[], weekStart: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of history) {
    if (p.status !== "approved") continue;
    const weeks = Math.round((Date.parse(weekStart) - Date.parse(p.weekOf)) / (7 * 86400_000));
    for (const d of p.days) if (d.recipeId && (!out.has(d.recipeId) || weeks < out.get(d.recipeId)!)) out.set(d.recipeId, weeks);
  }
  return out;
}

/** Fill the nights one at a time with the best dinner that fits, busiest nights first. */
function pickWeek(slots: Slot[], pool: Candidate[], newPool: Candidate[], settings: Settings, sales: SaleItem[]) {
  const planned: { slot: Slot; c: Candidate }[] = [];
  let newUsed = 0;
  const order = [...slots].sort((a, b) => Number(b.busy) - Number(a.busy) || a.index - b.index);
  for (const slot of order) {
    for (let relax = 0; relax <= 3; relax++) {
      const options = [...pool, ...(newUsed < settings.newRecipesPerWeek ? newPool : [])].filter((c) => fitsNight(c, slot, planned, settings, relax));
      if (!options.length) continue;
      const best = options.map((c) => ({ c, s: score(c, slot, sales) })).sort((a, b) => b.s - a.s)[0].c;
      planned.push({ slot, c: best });
      if (best.isNew) newUsed++;
      break;
    }
  }
  return planned.sort((a, b) => a.slot.index - b.slot.index);
}

function whyLine(c: Candidate, slot: Slot, sales: SaleItem[]): string {
  if (c.isNew) return newDay(slot.date, c.isNew, sales, undefined, null, []).reason;
  const onSale = recipeSales(c, sales);
  if (onSale.length) return saleReason(c.recipe!, sales);
  if (slot.busy && c.minutes != null && c.minutes <= 30) return `Quick for a busy ${dayName(slot.date)}: ${c.minutes} minutes`;
  if (c.rating === 5) return c.weeksSince != null && c.weeksSince >= 4 ? `A family favorite you haven't had in ${c.weeksSince} weeks` : "A family favorite";
  return "Picked from your recipes";
}

/** Used when no Claude key is configured: picks that follow every rule, leaning on sales and favorites; no costs. */
function basicPlan(dates: string[], pool: Recipe[], settings: Settings, sales: SaleItem[], newOptions: NewRecipeOption[], lastCooked: Map<string, number>): PlanResult {
  const slots = slotsFor(dates, settings, sales);
  const candidates = pool.map((r) => toCandidate(r, lastCooked));
  const planned = pickWeek(slots, candidates, newOptions.map(newCandidate), settings, sales);
  const used = new Set(planned.map((p) => p.c.key));
  const spare = candidates.filter((c) => !used.has(c.key));
  const days: PlanDay[] = dates.map((date, i) => {
    const hit = planned.find((p) => p.slot.index === i);
    if (!hit) return { date, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [], alternatives: [] };
    const alternatives = spare.filter((c) => fitsNight(c, hit.slot, planned.filter((p) => p !== hit), settings, 1)).slice(0, 3)
      .map((a) => ({ recipeId: a.key, recipeName: a.name, estimatedCost: null, reason: "From your recipes" }));
    if (hit.c.isNew) return newDay(date, hit.c.isNew, sales, undefined, null, alternatives);
    return { date, recipeId: hit.c.key, recipeName: hit.c.name, estimatedCost: null, reason: whyLine(hit.c, hit.slot, sales), saleItems: recipeSales(hit.c, sales), alternatives };
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

/**
 * Claude follows the rules nearly always; this makes the hard ones certain. Any night that breaks a busy-night
 * time limit, the protein cap, back-to-back proteins or fish freshness is re-picked with the same checks.
 */
export function enforceRules(days: PlanDay[], dates: string[], pool: Recipe[], settings: Settings, sales: SaleItem[], lastCooked: Map<string, number>, newOptions: NewRecipeOption[]): PlanDay[] {
  const slots = slotsFor(dates, settings, sales);
  const byKey = new Map<string, Candidate>([...pool.map((r) => toCandidate(r, lastCooked)), ...newOptions.map(newCandidate)].map((c) => [c.key, c]));
  const planned: { slot: Slot; c: Candidate }[] = [];
  const broken: Slot[] = [];
  for (const slot of [...slots].sort((a, b) => Number(b.busy) - Number(a.busy) || a.index - b.index)) {
    const c = days[slot.index].recipeId ? byKey.get(days[slot.index].recipeId!) : undefined;
    if (c && fitsNight(c, slot, planned, settings, 0)) planned.push({ slot, c });
    else if (c) broken.push(slot);
  }
  if (!broken.length) return days;
  const out = [...days];
  const boxPool = [...byKey.values()].filter((c) => !c.isNew);
  for (const slot of broken) {
    for (let relax = 0; relax <= 3; relax++) {
      const options = boxPool.filter((c) => fitsNight(c, slot, planned, settings, relax));
      if (!options.length) continue;
      const best = options.map((c) => ({ c, s: score(c, slot, sales) })).sort((a, b) => b.s - a.s)[0].c;
      planned.push({ slot, c: best });
      const was = out[slot.index];
      out[slot.index] = {
        ...was,
        recipeId: best.key,
        recipeName: best.name,
        estimatedCost: was.alternatives.find((a) => a.recipeId === best.key)?.estimatedCost ?? null,
        reason: whyLine(best, slot, sales),
        saleItems: recipeSales(best, sales),
        fromCook: null,
        alternatives: was.recipeId && !was.fromCook ? [{ recipeId: was.recipeId, recipeName: was.recipeName!, estimatedCost: was.estimatedCost, reason: was.reason }, ...was.alternatives.filter((a) => a.recipeId !== best.key)].slice(0, 3) : was.alternatives,
      };
      break;
    }
  }
  return out;
}

function saleReason(r: Pick<Recipe, "ingredients">, sales: SaleItem[]): string {
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
