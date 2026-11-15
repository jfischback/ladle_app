import type { Recipe } from "@/db/schema";
import type { Settings } from "./settings";
import type { PlanDay, PlanLunch, SaleItem } from "./types";
import { weekday, dayName } from "./week";
import { holidayOn } from "./holidays";
import { leftoverKind } from "./leftovers";
import { proteinGroup } from "./protein";
import { ruleProblems } from "./diet";
import { canCook } from "./prep";
import { recipeSales } from "./sales";

/** Words that name a kind of dish, so a BLT lunch and a BLT dinner on the same day count as the same thing. */
const DISH_WORDS = ["blt", "club", "sandwich", "wrap", "quesadilla", "taco", "tostada", "burrito", "pizza", "burger", "hot dog", "fried rice", "stir fry", "stir-fry", "omelet", "scramble", "soup", "chili", "salad", "pasta", "spaghetti", "penne", "mac and cheese", "sushi"];
const dishWords = (name: string) => DISH_WORDS.filter((w) => name.toLowerCase().includes(w));
export const sameDish = (a: string, b: string) => {
  const wa = dishWords(a);
  return wa.length > 0 && dishWords(b).some((w) => wa.includes(w));
};

function eatersFor(settings: Settings, holiday: boolean): { label: string; servings: number } {
  if (holiday) {
    const kids = settings.kids + (settings.hasBaby ? 1 : 0);
    return { label: `everyone: ${settings.adults} adult${settings.adults === 1 ? "" : "s"}${kids ? ` + ${kids === 1 && settings.hasBaby && !settings.kids ? "baby" : "kids"}` : ""}`, servings: settings.adults + settings.kids * 0.5 + (settings.hasBaby ? 0.5 : 0) };
  }
  const withKids = settings.lunchKids && (settings.kids > 0 || settings.hasBaby);
  const kidsLabel = settings.kids > 0 ? "kids" : "baby";
  return {
    label: `${settings.lunchAdults} adult${settings.lunchAdults === 1 ? "" : "s"}${withKids ? ` + ${kidsLabel}` : ""}`,
    servings: settings.lunchAdults + (withKids ? settings.kids * 0.5 + (settings.hasBaby ? 0.5 : 0) : 0),
  };
}

/**
 * Plan lunches for the week: leftovers from the night before when the dinner keeps (and, on a holiday, isn't a
 * protein someone won't eat reheated), otherwise a lunch recipe that fits the food rules and isn't the same dish
 * as that day's dinner. Weekday federal holidays plan lunch for everyone.
 */
export function planLunches(days: PlanDay[], settings: Settings, dinners: Map<string, Recipe>, lunchPool: Recipe[], sales: SaleItem[], breakfasts?: Map<string, Recipe>): PlanDay[] {
  const used = new Set<string>();
  const pool = lunchPool.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && canCook(r, settings.equipment) && !(r.rating != null && r.rating <= 2));
  return days.map((day, i) => {
    const wd = weekday(day.date);
    const holiday = holidayOn(day.date);
    const holidayLunch = !!holiday && wd >= 1 && wd <= 5 && settings.holidayEveryoneHome;
    if (!settings.lunchDays.includes(wd) && !holidayLunch) return { ...day, lunch: null, holiday };
    const eaters = eatersFor(settings, holidayLunch);

    const prev = i > 0 ? days[i - 1] : null;
    // The day after a holiday feast (or its leftovers night): feast leftovers.
    const feastDay = prev?.feast ? prev : prev?.leftoverOf && !prev.recipeId ? days.find((d) => d.date === prev.leftoverOf && d.feast) : undefined;
    if (feastDay?.feast) {
      return { ...day, holiday, lunch: { kind: "leftovers", recipeId: null, name: `${feastDay.feast.holiday} leftovers`, reason: "Turkey sandwiches and leftovers from the feast", eaters: eaters.label, servings: eaters.servings } };
    }
    const prevRecipe = prev?.recipeId ? dinners.get(prev.recipeId) : undefined;
    const reheatOk = !(holidayLunch && prevRecipe && settings.holidayNoReheat.includes(proteinGroup(prevRecipe)));
    if (prev?.recipeId && prevRecipe && leftoverKind(prevRecipe) === "ok" && reheatOk) {
      const lunch: PlanLunch = {
        kind: "leftovers",
        recipeId: prevRecipe.id,
        name: `Leftover ${prevRecipe.name}`,
        reason: `From ${dayName(prev.date)}'s dinner, cooked with extra`,
        eaters: eaters.label,
        servings: eaters.servings,
      };
      return { ...day, lunch, holiday };
    }

    const dinnerName = day.recipeName ?? "";
    const baconMorning = !!day.breakfast?.recipeId && !!breakfasts?.get(day.breakfast.recipeId)?.ingredients.some((i) => /bacon/i.test(i.item));
    const options = pool
      .filter((r) => !sameDish(r.name, dinnerName) && r.id !== day.recipeId)
      // A breakfast that opens a pack of bacon? Use it up in a bacon lunch the same day (a BLT).
      .map((r) => ({ r, s: (used.has(r.id) ? -3 : 0) + recipeSales(r, sales).length * 2 + (r.rating === 5 ? 2 : r.rating === 4 ? 1 : 0) + (baconMorning && r.ingredients.some((i) => /bacon/i.test(i.item)) ? 6 : 0) + Math.random() * 1.5 }))
      .sort((a, b) => b.s - a.s);
    const why = baconMorning && options[0]?.r.ingredients.some((i) => /bacon/i.test(i.item)) ? "Uses up the bacon from breakfast" : !prev?.recipeId ? "No dinner the night before" : prevRecipe && leftoverKind(prevRecipe) !== "ok" ? `${dayName(prev.date)}'s dinner is one night only` : "Leftovers wouldn't suit everyone today";
    if (!options.length) {
      return { ...day, holiday, lunch: { kind: "open", recipeId: null, name: "Lunch: your pick", reason: `${why}. Add lunch recipes to have one planned.`, eaters: eaters.label, servings: eaters.servings } };
    }
    const pick = options[0].r;
    used.add(pick.id);
    const onSale = recipeSales(pick, sales);
    return {
      ...day,
      holiday,
      lunch: { kind: "recipe", recipeId: pick.id, name: pick.name, reason: onSale.length ? `${why}; ${onSale[0]} is on sale` : why, eaters: eaters.label, servings: eaters.servings },
    };
  });
}

/** Grocery notes for dinners that should be cooked with extra for tomorrow's lunch. */
export function leftoverNotes(days: PlanDay[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < days.length; i++) {
    const l = days[i].lunch;
    if (l?.kind === "leftovers" && days[i - 1].recipeId) { // feast leftovers need no extra cooking
      // On a leftovers night nothing is cooked: the extra comes from the night it was cooked.
      const cookedOn = days[i - 1].leftoverOf ?? days[i - 1].date;
      out.push(`Make extra ${days[i - 1].recipeName} on ${dayName(cookedOn)} for ${dayName(days[i].date)}'s lunch (${l.eaters})${days[i].holiday ? `, ${days[i].holiday}` : ""}.`);
    }
  }
  return out;
}
