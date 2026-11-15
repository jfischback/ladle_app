import type { FoodRule } from "./diet";
import { ruleProblems } from "./diet";
import type { Nutrition, NutritionEstimate } from "./nutrition";
import type { PlanDay, SaleItem, GroceryItem } from "./types";

export type Sport = "strongman" | "powerlifting" | "bodybuilding" | "crossfit" | "endurance" | "combat" | "team" | "gym" | "active";
export type Phase = "bulk" | "maintain" | "cut";
type EventKind = "lift" | "show" | "race" | "weighin" | "game";

export type Athlete = {
  id: string;
  name: string;
  sport: Sport;
  phase: Phase;
  youth: boolean; // under 18: real food first, no protein powder unless allowed
  weightLb: number | null;
  milesPerWeek: number | null; // runners: more miles, more food
  calories: number; // a training day's target
  protein: number; // grams a day
  mealsPerDay: number; // 3-7, meals plus snacks/shakes
  trainingDays: number[]; // 0 = Sunday
  competitionDate: string | null; // YYYY-MM-DD: the next meet, show, race, weigh-in or game
  shakes: boolean; // happy to drink protein shakes
};

type SportInfo = {
  label: string; icon: string; blurb: string;
  kcalPerLb: number; proteinPerLb: number; meals: number;
  carbs: number; // how much training days lean on carbs (0-2)
  event: EventKind; eventLabel: string;
  likes: string[]; // fuel that suits this kind of athlete
  avoids?: string[];
};

export const SPORTS: Record<Sport, SportInfo> = {
  strongman: { label: "Strongman", icon: "🏋️", blurb: "The most food of all", kcalPerLb: 21, proteinPerLb: 1, meals: 6, carbs: 1, event: "lift", eventLabel: "meet", likes: ["chickenrice", "pbbanana", "wholemilk", "shake", "oats"] },
  powerlifting: { label: "Powerlifter", icon: "🏋️‍♀️", blurb: "Heavy lifting, less volume", kcalPerLb: 18, proteinPerLb: 1, meals: 5, carbs: 1, event: "lift", eventLabel: "meet", likes: ["chickenrice", "shake", "eggs", "oats"] },
  bodybuilding: { label: "Bodybuilder", icon: "🏆", blurb: "Lean protein, off-season or prep", kcalPerLb: 15.5, proteinPerLb: 1.1, meals: 6, carbs: 0.5, event: "show", eventLabel: "show", likes: ["chickenrice", "eggwhites", "cottage", "yogurt", "tuna", "shake"], avoids: ["pbbanana", "chocmilk", "bagelpb"] },
  crossfit: { label: "CrossFit", icon: "🔥", blurb: "Lots of carbs on workout days", kcalPerLb: 17, proteinPerLb: 0.9, meals: 5, carbs: 2, event: "lift", eventLabel: "competition", likes: ["oats", "chickenrice", "chocmilk", "bagelpb", "shake"] },
  endurance: { label: "Runner / triathlete", icon: "🏃", blurb: "Carbs first, carb-load before races", kcalPerLb: 15, proteinPerLb: 0.7, meals: 5, carbs: 2, event: "race", eventLabel: "race", likes: ["bagelpb", "pbbanana", "chocmilk", "oats"], avoids: ["jerky"] },
  combat: { label: "Fighter / wrestler", icon: "🥊", blurb: "Making weight, then refueling", kcalPerLb: 15, proteinPerLb: 1, meals: 5, carbs: 1, event: "weighin", eventLabel: "weigh-in", likes: ["chickenrice", "eggwhites", "yogurt", "tuna", "cottage"], avoids: ["pbbanana", "wholemilk"] },
  team: { label: "Team sports / teen athlete", icon: "⚽", blurb: "Practice most days, growing", kcalPerLb: 18, proteinPerLb: 0.8, meals: 5, carbs: 1.5, event: "game", eventLabel: "game", likes: ["chocmilk", "pbbanana", "bagelpb", "yogurt", "rollups"] },
  gym: { label: "Gym regular", icon: "💪", blurb: "A few workouts a week", kcalPerLb: 15, proteinPerLb: 0.9, meals: 4, carbs: 0.5, event: "lift", eventLabel: "competition", likes: ["shake", "yogurt", "bar", "rollups"] },
  active: { label: "Just active", icon: "🙂", blurb: "Mostly balance, a little extra", kcalPerLb: 14, proteinPerLb: 0.7, meals: 4, carbs: 0.5, event: "game", eventLabel: "event", likes: ["yogurt", "eggs", "cottage"] },
};

export const PHASES: Record<Phase, { label: string; blurb: string; kcal: number; protein: number }> = {
  bulk: { label: "Bulk", blurb: "Adding size", kcal: 1.1, protein: 0 },
  maintain: { label: "Maintain", blurb: "Holding steady", kcal: 1, protein: 0 },
  cut: { label: "Cut", blurb: "Losing fat, keeping muscle", kcal: 0.8, protein: 0.1 },
};

const round = (n: number, to: number) => Math.round(n / to) * to;

/** Starting numbers from body weight, type and phase (common rules of thumb, not medical advice). */
export function suggestTargets(a: Pick<Athlete, "sport" | "phase" | "youth" | "milesPerWeek">, weightLb: number): { calories: number; protein: number } {
  const s = SPORTS[a.sport];
  let kcalPerLb = s.kcalPerLb;
  // Runners: about 14 a pound plus more for every 10 miles a week.
  if (a.sport === "endurance" && a.milesPerWeek) kcalPerLb = Math.min(22, 14 + a.milesPerWeek / 10);
  // Bodybuilders swing harder between off-season and prep.
  const phaseK = a.sport === "bodybuilding" ? { bulk: 17 / 15.5, maintain: 1, cut: 12 / 15.5 }[a.phase] : PHASES[a.phase].kcal;
  let proteinPerLb = s.proteinPerLb + PHASES[a.phase].protein;
  // Growing teens: plenty of food, and protein from meals rather than big targets.
  if (a.youth) { kcalPerLb += 1; proteinPerLb = Math.min(proteinPerLb, 0.8); }
  return {
    calories: Math.min(7000, Math.max(1400, round(weightLb * kcalPerLb * phaseK, 50))),
    protein: Math.min(400, Math.max(50, round(weightLb * proteinPerLb, 5))),
  };
}

export function newAthlete(name = ""): Athlete {
  return { id: Math.random().toString(36).slice(2, 10), name, sport: "gym", phase: "maintain", youth: false, weightLb: null, milesPerWeek: null, calories: 2600, protein: 160, mealsPerDay: 4, trainingDays: [1, 3, 5], competitionDate: null, shakes: true };
}

const LEGACY_GOAL: Record<string, { sport: Sport; phase: Phase }> = {
  strength: { sport: "strongman", phase: "maintain" }, muscle: { sport: "gym", phase: "bulk" }, maintain: { sport: "active", phase: "maintain" },
  lose: { sport: "gym", phase: "cut" }, endurance: { sport: "endurance", phase: "maintain" },
};

/** Athletes saved before athlete types existed had a "goal"; give them a type and phase. */
export function normalizeAthlete(raw: Partial<Athlete> & { goal?: string }): Athlete {
  const base = newAthlete(raw.name ?? "");
  const legacy = raw.goal ? LEGACY_GOAL[raw.goal] : undefined;
  const { goal: _goal, ...rest } = raw;
  void _goal;
  return { ...base, ...legacy, ...rest, sport: raw.sport && raw.sport in SPORTS ? raw.sport : legacy?.sport ?? base.sport, phase: raw.phase ?? legacy?.phase ?? "maintain", youth: raw.youth ?? false, milesPerWeek: raw.milesPerWeek ?? null } as Athlete;
}

/** How many family-size servings this person eats at a meal: a bigger appetite gets 1.5 or 2 portions. */
export function portionFor(a: Athlete): number {
  // A family serving is around 650 calories; a main meal is about a third of the day.
  return Math.min(3, Math.max(1, round((a.calories * 0.32) / 650, 0.5)));
}

/** A rest day's calories: a bit less than a training day. Protein stays the same. */
export const dayTarget = (a: Athlete, weekdayNum: number) => ({
  kcal: a.trainingDays.length === 0 || a.trainingDays.includes(weekdayNum) ? a.calories : round(a.calories * 0.9, 50),
  protein: a.protein,
});

/** Where a day sits relative to the next event, and what that means for food. */
export type EventDay = { phase: "load" | "lighten" | "eve" | "day" | "after"; daysOut: number; label: string; kcal: number; carbs: number; tip: string };

export function eventDay(a: Athlete, date: string): EventDay | null {
  if (!a.competitionDate) return null;
  const out = Math.round((Date.parse(`${a.competitionDate}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000);
  const s = SPORTS[a.sport];
  const L = s.eventLabel;
  const cap = L.charAt(0).toUpperCase() + L.slice(1);
  switch (s.event) {
    case "race":
      if (out >= 1 && out <= 3) return { phase: "load", daysOut: out, label: `Carb-load · race in ${out} day${out === 1 ? "" : "s"}`, kcal: 1.1, carbs: 3, tip: "Carb-load: extra rice, pasta, bagels and potatoes; go lighter on fat and fiber so race day feels good." };
      if (out === 0) return { phase: "day", daysOut: 0, label: "🏁 Race day", kcal: 1, carbs: 2, tip: "Race day: a familiar carb breakfast 3 hours before (bagel, banana, oats). Refuel with chocolate milk after." };
      return null;
    case "weighin":
      if (out >= 1 && out <= 3) return { phase: "lighten", daysOut: out, label: `Weigh-in in ${out} day${out === 1 ? "" : "s"}`, kcal: 0.85, carbs: -1, tip: "Making weight: lighter, lower-salt meals and lean protein. Follow your coach's cut; Ladle keeps it simple." };
      if (out === 0) return { phase: "day", daysOut: 0, label: "⚖️ Weigh-in day", kcal: 1, carbs: 2, tip: "After weigh-in: refuel with fluids, carbs and a familiar meal (chicken and rice is perfect)." };
      return null;
    case "show":
      if (out >= 1 && out <= 6) return { phase: "lighten", daysOut: out, label: `Peak week · show in ${out} day${out === 1 ? "" : "s"}`, kcal: 1, carbs: 0, tip: "Peak week: follow your coach's plan exactly. Ladle keeps meals plain and lean." };
      if (out === 0) return { phase: "day", daysOut: 0, label: "🏆 Show day", kcal: 1, carbs: 1, tip: "Show day: small, familiar meals your coach planned." };
      return null;
    case "game":
      if (out === 1) return { phase: "eve", daysOut: 1, label: `${cap} tomorrow`, kcal: 1.05, carbs: 2, tip: "Big day tomorrow: a carb-rich dinner (pasta, rice or potatoes) and plenty of water." };
      if (out === 0) return { phase: "day", daysOut: 0, label: `🏆 ${cap} day`, kcal: 1, carbs: 2, tip: `${cap} day: a carb-rich meal 3-4 hours before, a light snack an hour before, then protein and carbs after.` };
      return null;
    case "lift":
      if (out === 1) return { phase: "eve", daysOut: 1, label: `${cap} tomorrow`, kcal: 1.05, carbs: 2, tip: `${cap} tomorrow: carb up tonight (extra rice, pasta or potatoes) and go easy on greasy or very high-fiber food.` };
      if (out === 0) return { phase: "day", daysOut: 0, label: `🏆 ${cap} day`, kcal: 1, carbs: 2, tip: a.sport === "strongman" ? "Meet day: familiar food, a carb-rich meal 3-4 hours before, then easy snacks between events (bananas, PB sandwiches, chocolate milk)." : `${cap} day: stick to familiar food. A carb-rich meal 3-4 hours before, small snacks between attempts or heats.` };
      return null;
  }
}

// ---------- fuel: the high-protein snacks and shakes that close the gap ----------

type Buy = { item: string; per: number; unit: "ct" | "pkg" | "lb"; pkg?: string; term: string };
export type Fuel = { id: string; name: string; kcal: number; protein: number; carbs: boolean; shake?: boolean; buys: Buy[] };

export const FUEL: Fuel[] = [
  { id: "shake", name: "Protein shake with milk", kcal: 330, protein: 40, carbs: false, shake: true, buys: [{ item: "Protein powder", per: 1 / 30, unit: "pkg", pkg: "tub (about 30 scoops)", term: "protein powder" }, { item: "Milk", per: 1 / 16, unit: "pkg", pkg: "gallon", term: "milk" }] },
  { id: "yogurt", name: "Greek yogurt cup", kcal: 140, protein: 15, carbs: false, buys: [{ item: "Greek yogurt cups", per: 1, unit: "ct", term: "greek yogurt" }] },
  { id: "cottage", name: "Cottage cheese and fruit", kcal: 240, protein: 25, carbs: false, buys: [{ item: "Cottage cheese", per: 1 / 3, unit: "pkg", pkg: "tub (24 oz)", term: "cottage cheese" }, { item: "Fruit for snacks", per: 1, unit: "ct", term: "fruit" }] },
  { id: "eggs", name: "3 hard-boiled eggs", kcal: 215, protein: 19, carbs: false, buys: [{ item: "Eggs", per: 1 / 4, unit: "pkg", pkg: "dozen", term: "eggs" }] },
  { id: "jerky", name: "Beef jerky", kcal: 230, protein: 18, carbs: false, buys: [{ item: "Beef jerky", per: 2 / 3, unit: "pkg", pkg: "bag", term: "beef jerky" }] },
  { id: "rollups", name: "Turkey and cheese roll-ups", kcal: 250, protein: 26, carbs: false, buys: [{ item: "Deli turkey", per: 1 / 4, unit: "lb", term: "deli turkey" }, { item: "String cheese", per: 1, unit: "ct", term: "string cheese" }] },
  { id: "chickenrice", name: "Chicken and rice box", kcal: 550, protein: 45, carbs: true, buys: [{ item: "Chicken breast", per: 0.4, unit: "lb", term: "chicken breast" }, { item: "Rice", per: 1 / 20, unit: "pkg", pkg: "bag", term: "rice" }] },
  { id: "tuna", name: "Tuna pouch and crackers", kcal: 260, protein: 27, carbs: false, buys: [{ item: "Tuna pouches", per: 1, unit: "ct", term: "tuna pouch" }, { item: "Crackers", per: 1 / 10, unit: "pkg", pkg: "box", term: "crackers" }] },
  { id: "pbbanana", name: "Peanut butter and banana sandwich", kcal: 450, protein: 16, carbs: true, buys: [{ item: "Bread", per: 1 / 10, unit: "pkg", pkg: "loaf", term: "bread" }, { item: "Peanut butter", per: 1 / 14, unit: "pkg", pkg: "jar", term: "peanut butter" }, { item: "Bananas", per: 1, unit: "ct", term: "bananas" }] },
  { id: "oats", name: "Protein overnight oats", kcal: 450, protein: 30, carbs: true, buys: [{ item: "Old-fashioned oats", per: 1 / 15, unit: "pkg", pkg: "canister", term: "oats" }, { item: "Plain Greek yogurt", per: 1 / 4, unit: "pkg", pkg: "tub (32 oz)", term: "plain greek yogurt" }] },
  { id: "chocmilk", name: "Chocolate milk after training", kcal: 380, protein: 16, carbs: true, buys: [{ item: "Chocolate milk", per: 1 / 4, unit: "pkg", pkg: "half-gallon jug", term: "chocolate milk" }] },
  { id: "wholemilk", name: "Big glass of whole milk (16 oz)", kcal: 300, protein: 16, carbs: true, buys: [{ item: "Whole milk", per: 1 / 8, unit: "pkg", pkg: "gallon", term: "whole milk" }] },
  { id: "bagelpb", name: "Bagel with peanut butter", kcal: 480, protein: 17, carbs: true, buys: [{ item: "Bagels", per: 1 / 6, unit: "pkg", pkg: "bag", term: "bagels" }, { item: "Peanut butter", per: 1 / 14, unit: "pkg", pkg: "jar", term: "peanut butter" }] },
  { id: "eggwhites", name: "Egg white and veggie scramble", kcal: 160, protein: 26, carbs: false, buys: [{ item: "Liquid egg whites", per: 1 / 4, unit: "pkg", pkg: "carton (32 oz)", term: "egg whites" }] },
  { id: "bar", name: "Protein bar", kcal: 220, protein: 20, carbs: false, buys: [{ item: "Protein bars", per: 1, unit: "ct", term: "protein bars" }] },
];

/** Fuel this family can have, given their food rules and dislikes. */
export function allowedFuel(a: Athlete, rules: FoodRule[], dislikes: string[], allowAnyway: string[]): Fuel[] {
  // Teens without the shake OK: real food only (no protein powder or bars).
  return FUEL.filter((f) => (a.shakes || !f.shake) && !(a.youth && !a.shakes && f.id === "bar") && !ruleProblems({ name: f.name, ingredients: f.buys.map((b) => ({ amount: "1", unit: "", item: b.item })) }, rules, dislikes, allowAnyway).length);
}

/** Search terms for the price check, so on-sale fuel can come first. */
export function fuelTerms(athletes: Athlete[], rules: FoodRule[], dislikes: string[], allowAnyway: string[]): string[] {
  const ids = new Set(athletes.flatMap((a) => allowedFuel(a, rules, dislikes, allowAnyway).map((f) => f.id)));
  return [...new Set(FUEL.filter((f) => ids.has(f.id)).map((f) => f.buys[0].term))];
}

// ---------- one athlete's week ----------

export type MealLine = { meal: "Breakfast" | "Lunch" | "Dinner"; name: string; portion: number; kcal: number; protein: number; estimated: boolean };
export type AthleteDay = {
  date: string;
  training: boolean;
  event: EventDay | null;
  target: { kcal: number; protein: number };
  meals: MealLine[];
  fuel: { id: string; name: string; kcal: number; protein: number; onSale: boolean }[];
  total: { kcal: number; protein: number };
  short: { kcal: number; protein: number }; // still missing after fuel (0 when on target)
  tip: string | null;
};
export type AthleteWeek = { athlete: Athlete; portion: number; days: AthleteDay[]; fuelCount: Record<string, number> };

// About how much of the day each meal covers.
const SHARE: Record<MealLine["meal"], number> = { Breakfast: 0.22, Lunch: 0.26, Dinner: 0.3 };

// When a recipe's numbers aren't known, assume an ordinary family serving.
const TYPICAL: Record<MealLine["meal"], Nutrition> = {
  Breakfast: { kcal: 400, protein: 22, carbs: 35, fat: 18 },
  Lunch: { kcal: 550, protein: 30, carbs: 50, fat: 22 },
  Dinner: { kcal: 700, protein: 38, carbs: 60, fat: 30 },
};

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function planAthleteWeek(
  a: Athlete,
  days: PlanDay[],
  nutrition: Map<string, NutritionEstimate>,
  fuel: Fuel[],
  sales: SaleItem[],
): AthleteWeek {
  const portion = portionFor(a);
  const saleTerms = new Set(sales.map((s) => s.item));
  const onSale = (f: Fuel) => f.buys.some((b) => saleTerms.has(b.term));
  const used: Record<string, number> = {};
  const out: AthleteDay[] = [];

  for (const d of days) {
    const wd = weekdayOf(d.date);
    const training = a.trainingDays.includes(wd);
    const event = eventDay(a, d.date);
    const base0 = dayTarget(a, wd);
    const target = { kcal: round(base0.kcal * (event?.kcal ?? 1), 50), protein: base0.protein };
    const sport = SPORTS[a.sport];
    const meals: MealLine[] = [];
    const add = (meal: MealLine["meal"], name: string | null | undefined, recipeId: string | null | undefined) => {
      if (!name) return;
      const n = recipeId ? nutrition.get(recipeId) : undefined;
      const good = n && n.coverage >= 0.6 && n.kcal >= 120;
      const base = good ? n! : TYPICAL[meal];
      // Size each meal to the recipe: a light omelet gets 2 portions, a heavy chicken-fried steak stays at 1.
      const p = Math.min(portion, Math.max(1, round((target.kcal * SHARE[meal]) / base.kcal, 0.5)));
      meals.push({ meal, name, portion: p, kcal: Math.round(base.kcal * p), protein: Math.round(base.protein * p), estimated: !good });
    };
    add("Breakfast", d.breakfast?.name, d.breakfast?.recipeId);
    if (d.lunch && d.lunch.kind !== "open") add("Lunch", d.lunch.name, d.lunch.recipeId);
    add("Dinner", d.recipeName, d.recipeId);
    // Meals Ladle doesn't plan (a packed lunch, a night off) still happen: count a typical one so fuel isn't overdone.
    for (const m of ["Breakfast", "Lunch", "Dinner"] as const) {
      if (!meals.some((x) => x.meal === m)) meals.push({ meal: m, name: m === "Dinner" ? "Night off (your own dinner)" : `Your own ${m.toLowerCase()}`, portion: 1, kcal: Math.round(target.kcal * SHARE[m]), protein: Math.round(target.protein * SHARE[m]), estimated: true });
    }
    meals.sort((x, y) => ["Breakfast", "Lunch", "Dinner"].indexOf(x.meal) - ["Breakfast", "Lunch", "Dinner"].indexOf(y.meal));

    let kcal = meals.reduce((n, m) => n + m.kcal, 0);
    let protein = meals.reduce((n, m) => n + m.protein, 0);
    const picks: AthleteDay["fuel"] = [];
    const slots = Math.max(1, a.mealsPerDay - 3);
    const shakesToday = () => picks.filter((p) => FUEL.find((f) => f.id === p.id)?.shake).length;
    for (let i = 0; i < slots + 2; i++) {
      const pGap = target.protein - protein;
      const kGap = target.kcal - kcal;
      // One extra pick past the planned snacks only if protein is still well short.
      if (i >= slots && pGap < 25 && kGap < 600) break;
      if (pGap < 10 && kGap < 200) break;
      if (kGap < -300 && pGap < 25) break; // already well over calories: don't add food for a few grams
      const choices = fuel.filter((f) => !picks.some((p) => p.id === f.id) && !(f.shake && shakesToday() >= (training ? 2 : 1)));
      if (!choices.length) break;
      const scored = choices.map((f) => {
        let s = Math.min(f.protein, Math.max(pGap, 0)) / 10; // protein that's needed
        s += kGap > 400 ? f.kcal / 300 : kGap < 0 ? -f.kcal / 150 : 0; // calories: more when far short, leaner when over
        if (training && f.carbs) s += sport.carbs * 0.6; // carbs on training days, more for runners and CrossFit
        if (event && f.carbs) s += event.carbs * 0.6; // carb-load before a race, lighter before a weigh-in
        if (sport.likes.includes(f.id)) s += 0.8; // suits this kind of athlete
        if (sport.avoids?.includes(f.id)) s -= 1.5;
        if (a.phase === "cut") s -= f.kcal / 600; // fewer calories per gram of protein on a cut
        if (onSale(f)) s += 1;
        s -= (used[f.id] ?? 0) * 0.6; // variety across the week
        return { f, s };
      });
      scored.sort((x, y) => y.s - x.s || x.f.id.localeCompare(y.f.id));
      const f = scored[0].f;
      picks.push({ id: f.id, name: f.name, kcal: f.kcal, protein: f.protein, onSale: onSale(f) });
      used[f.id] = (used[f.id] ?? 0) + 1;
      kcal += f.kcal;
      protein += f.protein;
    }
    const tip =
      event ? event.tip
      : training && target.protein - protein > 20 ? "Training day: add another shake or a double portion at dinner to hit protein."
      : null;
    out.push({
      date: d.date, training, event, target, meals, fuel: picks,
      total: { kcal, protein },
      short: { kcal: Math.max(0, target.kcal - kcal), protein: Math.max(0, target.protein - protein) },
      tip,
    });
  }
  return { athlete: a, portion, days: out, fuelCount: used };
}

/** The grocery lines for everyone's fuel this week. */
export function fuelGroceries(weeks: AthleteWeek[], sales: SaleItem[]): GroceryItem[] {
  const need = new Map<string, { buy: Buy; amount: number; who: Set<string> }>();
  for (const w of weeks) {
    for (const [id, count] of Object.entries(w.fuelCount)) {
      const f = FUEL.find((x) => x.id === id);
      if (!f) continue;
      for (const b of f.buys) {
        const e = need.get(b.item) ?? { buy: b, amount: 0, who: new Set<string>() };
        e.amount += b.per * count;
        e.who.add(w.athlete.name || "athlete");
        need.set(b.item, e);
      }
    }
  }
  const saleBy = new Map(sales.map((s) => [s.item, s]));
  return [...need.values()].map(({ buy, amount, who }) => {
    const n = Math.ceil(amount);
    const pkg = buy.pkg ?? "package";
    const qty = buy.unit === "ct" ? String(n) : buy.unit === "lb" ? `${Math.max(0.5, Math.ceil(amount * 2) / 2)} lb` : `${n} ${n > 1 ? plural(pkg) : pkg}`;
    const s = saleBy.get(buy.term);
    return { item: buy.item, quantity: qty, note: [s ? `On sale $${s.salePrice.toFixed(2)} (${s.pctOff}% off)` : "", `For ${[...who].join(" & ")}`].filter(Boolean).join(" · "), forRecipes: [] };
  });
}

const plural = (pkg: string) => (/dozen/.test(pkg) ? pkg : pkg.replace(/(\w+)(\s*\(.*\))?$/, (_, w: string, rest = "") => `${w === "loaf" ? "loaves" : /s$/.test(w) ? w : `${w}s`}${rest}`));

/** For the grocery list: cook extra at meals for the bigger appetites (from the portions planned this week). */
export function portionNotes(weeks: AthleteWeek[]): string[] {
  return weeks.flatMap((w) => {
    const dinners = w.days.flatMap((d) => d.meals.filter((m) => m.meal === "Dinner" && !m.estimated));
    if (!dinners.length) return [];
    const p = round(dinners.reduce((n, m) => n + m.portion, 0) / dinners.length, 0.5);
    if (p <= 1) return [];
    const extra = p - 1;
    return [`${w.athlete.name || "Your athlete"} eats about ${p} portions at meals: cook ${extra === 1 ? "one extra portion" : `${extra} extra portions`} for them.`];
  });
}
