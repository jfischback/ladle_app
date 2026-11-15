import type { Recipe } from "@/db/schema";
import type { Settings } from "./settings";
import type { PlanBreakfast, PlanDay, SaleItem } from "./types";
import { weekday } from "./week";
import { holidayOn } from "./holidays";
import { ruleProblems } from "./diet";
import { recipeSales } from "./sales";

/** What we search the store for when looking for the week's breakfast-meat deal. */
export const BREAKFAST_MEAT_TERMS = ["ham", "breakfast sausage", "precooked bacon", "deli turkey"];

const isBread = (r: Recipe) => r.tags.includes("bread-based");
const MEATY = /ham\b|bacon|sausage|breakfast[- ]meat|deal\)/i;
export const usesBacon = (r: Pick<Recipe, "ingredients">) => r.ingredients.some((i) => /bacon/i.test(i.item));

/** The best breakfast-meat sale this week (at least the household's "counts as a sale" discount), if any. */
export function breakfastDeal(sales: SaleItem[]): SaleItem | null {
  return sales.filter((s) => BREAKFAST_MEAT_TERMS.includes(s.item)).sort((a, b) => b.pctOff - a.pctOff)[0] ?? null;
}

function eaters(settings: Settings, holiday: boolean) {
  if (holiday) {
    const little = settings.kids > 0 ? "kids" : settings.hasBaby ? "baby" : "";
    return { label: `everyone: ${settings.adults} adult${settings.adults === 1 ? "" : "s"}${little ? ` + ${little}` : ""}`, servings: settings.adults + settings.kids * 0.5 + (settings.hasBaby ? 0.5 : 0) };
  }
  const withKids = settings.breakfastKids && (settings.kids > 0 || settings.hasBaby);
  return {
    label: `${settings.breakfastAdults} adult${settings.breakfastAdults === 1 ? "" : "s"}${withKids ? ` + ${settings.kids > 0 ? "kids" : "baby"}` : ""}`,
    servings: settings.breakfastAdults + (withKids ? settings.kids * 0.5 + (settings.hasBaby ? 0.5 : 0) : 0),
  };
}

const shuffle = <T,>(xs: T[]) => xs.map((x) => ({ x, r: Math.random() })).sort((a, b) => a.r - b.r).map((o) => o.x);

/**
 * Plan the week's breakfasts: quick ones only, the household's mix of bread-based and egg/protein breakfasts,
 * each "must have" at least once, few repeats, and the week's breakfast-meat deal in the egg breakfasts.
 * Weekday federal holidays plan breakfast for everyone.
 */
export function planBreakfasts(days: PlanDay[], settings: Settings, pool: Recipe[], sales: SaleItem[], deal: SaleItem | null): PlanDay[] {
  const slots = days
    .map((d, i) => {
      const wd = weekday(d.date);
      const holiday = !!holidayOn(d.date) && wd >= 1 && wd <= 5 && settings.holidayEveryoneHome;
      return settings.breakfastDays.includes(wd) || holiday ? { i, holiday } : null;
    })
    .filter((x): x is { i: number; holiday: boolean } => !!x);
  if (!slots.length) return days.map((d) => ({ ...d, breakfast: null }));

  const ok = pool.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && !(r.rating != null && r.rating <= 2));
  const quick = ok.filter((r) => r.totalMinutes == null || r.totalMinutes <= settings.breakfastMaxMinutes);
  const choices = quick.length ? quick : ok;
  const score = (r: Recipe) => recipeSales(r, sales).length * 2 + (r.rating === 5 ? 2 : r.rating === 4 ? 1 : 0) + Math.random() * 2;
  const best = (rs: Recipe[], avoid: Set<string>) => {
    const fresh = rs.filter((r) => !avoid.has(r.id));
    return (fresh.length ? fresh : rs).map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s)[0]?.r ?? null;
  };

  const picks: Recipe[] = [];
  const used = new Set<string>();
  const take = (r: Recipe | null) => { if (r && picks.length < slots.length) { picks.push(r); used.add(r.id); } };
  // 1. Must-haves first ("omelet" every week).
  for (const word of settings.breakfastMustHave) take(best(choices.filter((r) => r.name.toLowerCase().includes(word.toLowerCase().replace(/s$/, ""))), used));
  // 2. Bread-based up to the household's number, 3. egg/protein for the rest.
  const breadWanted = Math.min(settings.breadBreakfasts, slots.length);
  while (picks.filter(isBread).length < breadWanted && picks.length < slots.length) { const r = best(choices.filter(isBread), used); if (!r) break; take(r); }
  while (picks.length < slots.length) { const r = best(choices.filter((x) => !isBread(x)), used) ?? best(choices, used); if (!r) break; take(r); }

  // Spread them out so the same breakfast isn't two mornings in a row.
  let order = shuffle(picks);
  for (let tries = 0; tries < 10 && order.some((r, k) => k > 0 && r.id === order[k - 1].id); tries++) order = shuffle(picks);

  const out = days.map((d) => ({ ...d, breakfast: null as PlanBreakfast | null }));
  slots.forEach((slot, k) => {
    const r = order[k];
    const who = eaters(settings, slot.holiday);
    if (!r) {
      out[slot.i].breakfast = { recipeId: null, name: "Breakfast: your pick", reason: "Add a few quick breakfast recipes to have one planned.", eaters: who.label, servings: who.servings };
      return;
    }
    const withDeal = deal && !isBread(r) && r.ingredients.some((i) => MEATY.test(i.item)) ? `${deal.item}, ${deal.pctOff}% off` : null;
    const must = settings.breakfastMustHave.find((w) => r.name.toLowerCase().includes(w.toLowerCase().replace(/s$/, "")));
    out[slot.i].breakfast = {
      recipeId: r.id,
      name: r.name,
      reason: withDeal ? `Uses this week's breakfast-meat deal: ${withDeal}` : must ? `Your every-week ${must}` : isBread(r) ? "This week's bread-based breakfast" : r.totalMinutes ? `Ready in ${r.totalMinutes} minutes` : "Quick and easy",
      eaters: who.label,
      servings: who.servings,
      withDeal,
    };
  });
  return out;
}
