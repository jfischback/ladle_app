import type { FoodRule } from "./diet";
import { ruleProblems } from "./diet";
import type { Nutrition, NutritionEstimate } from "./nutrition";
import type { PlanDay, SaleItem, GroceryItem } from "./types";

export type AthleteGoal = "strength" | "muscle" | "maintain" | "lose" | "endurance";

export type Athlete = {
  id: string;
  name: string;
  goal: AthleteGoal;
  weightLb: number | null;
  calories: number; // a training day's target
  protein: number; // grams a day
  mealsPerDay: number; // 3-7, meals plus snacks/shakes
  trainingDays: number[]; // 0 = Sunday
  competitionDate: string | null; // YYYY-MM-DD
  shakes: boolean; // happy to drink protein shakes
};

export const GOALS: Record<AthleteGoal, { label: string; icon: string; blurb: string; proteinPerLb: number; kcalPerLb: number }> = {
  strength: { label: "Strength / strongman", icon: "🏋️", blurb: "Lifting heavy, needs lots of food", proteinPerLb: 1, kcalPerLb: 20 },
  muscle: { label: "Build muscle", icon: "💪", blurb: "Gym regular, adding size", proteinPerLb: 1, kcalPerLb: 17 },
  maintain: { label: "Stay fit", icon: "🙂", blurb: "Active, keeping things steady", proteinPerLb: 0.8, kcalPerLb: 15 },
  lose: { label: "Lose fat", icon: "🔥", blurb: "Smaller portions, keep the protein high", proteinPerLb: 1, kcalPerLb: 12 },
  endurance: { label: "Running / endurance", icon: "🏃", blurb: "More carbs on long days", proteinPerLb: 0.7, kcalPerLb: 17 },
};

const round = (n: number, to: number) => Math.round(n / to) * to;

/** Starting numbers from body weight and goal (a common rule of thumb, not medical advice). */
export function suggestTargets(goal: AthleteGoal, weightLb: number): { calories: number; protein: number } {
  const g = GOALS[goal];
  return { calories: Math.min(7000, Math.max(1400, round(weightLb * g.kcalPerLb, 50))), protein: Math.min(400, Math.max(60, round(weightLb * g.proteinPerLb, 5))) };
}

export function newAthlete(name = ""): Athlete {
  return { id: Math.random().toString(36).slice(2, 10), name, goal: "strength", weightLb: null, calories: 3500, protein: 200, mealsPerDay: 5, trainingDays: [1, 2, 4, 5], competitionDate: null, shakes: true };
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
  { id: "bar", name: "Protein bar", kcal: 220, protein: 20, carbs: false, buys: [{ item: "Protein bars", per: 1, unit: "ct", term: "protein bars" }] },
];

/** Fuel this family can have, given their food rules and dislikes. */
export function allowedFuel(a: Athlete, rules: FoodRule[], dislikes: string[], allowAnyway: string[]): Fuel[] {
  return FUEL.filter((f) => (a.shakes || !f.shake) && !ruleProblems({ name: f.name, ingredients: f.buys.map((b) => ({ amount: "1", unit: "", item: b.item })) }, rules, dislikes, allowAnyway).length);
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
  meet: "eve" | "day" | null;
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
const addDay = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

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
    const meet = a.competitionDate === d.date ? "day" : a.competitionDate === addDay(d.date, 1) ? "eve" : null;
    const target = dayTarget(a, wd);
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
      const choices = fuel.filter((f) => !picks.some((p) => p.id === f.id) && !(f.shake && shakesToday() >= (training ? 2 : 1)));
      if (!choices.length) break;
      const scored = choices.map((f) => {
        let s = Math.min(f.protein, Math.max(pGap, 0)) / 10; // protein that's needed
        s += kGap > 400 ? f.kcal / 300 : kGap < 0 ? -f.kcal / 300 : 0; // calories: more when far short, fewer when over
        if (training && f.carbs) s += 1; // carbs on training days
        if (meet && f.carbs) s += 1.5;
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
      meet === "eve" ? "Meet tomorrow: carb up tonight (extra rice, pasta or potatoes) and go easy on greasy or very high-fiber food."
      : meet === "day" ? "Meet day: stick to familiar food. Eat a carb-rich meal 3-4 hours before, then small snacks between events."
      : training && target.protein - protein > 20 ? "Training day: add another shake or a double portion at dinner to hit protein."
      : null;
    out.push({
      date: d.date, training, meet, target, meals, fuel: picks,
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
