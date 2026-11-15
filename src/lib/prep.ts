import type { Ingredient, PlanDay } from "./types";
import { parseAmount } from "./nutrition";

// ---------- kitchen equipment ----------

export type Equipment = "oven" | "stovetop" | "microwave" | "slow cooker" | "pressure cooker" | "grill" | "air fryer";
export const EQUIPMENT: { key: Equipment; label: string; icon: string }[] = [
  { key: "oven", label: "Oven", icon: "🔥" },
  { key: "stovetop", label: "Stovetop", icon: "🍳" },
  { key: "microwave", label: "Microwave", icon: "📡" },
  { key: "slow cooker", label: "Slow cooker", icon: "🥘" },
  { key: "pressure cooker", label: "Instant Pot", icon: "⏲️" },
  { key: "grill", label: "Grill", icon: "🔥" },
  { key: "air fryer", label: "Air fryer", icon: "🌀" },
];

type RecipeLike = { name: string; ingredients: Ingredient[]; steps?: string[]; tags?: string[]; totalMinutes?: number | null; prepAhead?: string | null };
const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** What a recipe needs to cook, from its steps and tags. */
export function equipmentNeeded(r: RecipeLike): Set<Equipment> {
  const text = plain([...(r.steps ?? []), r.name].join(" "));
  const tags = r.tags ?? [];
  const need = new Set<Equipment>();
  if (/\b(oven|bake[sd]?|baking|roast(ed|ing)?|broil)\b/.test(text) || tags.includes("sheet-pan")) need.add("oven");
  if (/\b(skillet|saucepan|pot|boil|simmer|saute|fry|frying|griddle|stir-fry|wok|sear|brown the|scramble|toast in|cook the (rice|pasta|spaghetti|noodles|shells|ziti|penne|macaroni|lentils|quinoa))\b/.test(text) && !/^microwave/.test(plain(r.name))) need.add("stovetop");
  if (/slow cooker|crock ?pot/.test(text) || tags.includes("slow-cooker")) need.add("slow cooker");
  if (/instant pot|pressure cook/.test(text)) need.add("pressure cooker");
  if (/\bgrill(ed|ing)?\b/.test(text) || tags.includes("grill")) need.add("grill");
  if (/air fryer/.test(text)) need.add("air fryer");
  if (/microwave/.test(text) && need.size === 0) need.add("microwave");
  return need;
}

/** Can this kitchen cook it? A slow cooker, Instant Pot or grill dish can also be done on a stovetop; an air fryer dish in the oven. */
export function canCook(r: RecipeLike, have: Equipment[]): boolean {
  if (!have.length) return true;
  const h = new Set(have);
  for (const n of equipmentNeeded(r)) {
    if (h.has(n)) continue;
    if ((n === "slow cooker" || n === "pressure cooker") && h.has("stovetop")) continue;
    if (n === "grill" && (h.has("stovetop") || h.has("oven"))) continue;
    if (n === "air fryer" && h.has("oven")) continue;
    return false;
  }
  return true;
}

// ---------- meal prep day ----------

export type PrepTask = { title: string; detail: string; minutes: number; forDinners: string[]; kind: "grain" | "chop" | "protein" | "marinate" | "assemble" };
export type PrepPlan = { date: string; minutes: number; tasks: PrepTask[]; later: PrepTask[]; finish: Record<string, number> };

const CHOPPED = /\b(chopped|diced|minced|sliced|julienned|grated|cut into|cubed)\b/;
// Vegetables that keep well cut for a few days (potatoes, apples and avocados brown, so they're left for the night).
const VEG = /\b(onions?|shallots?|garlic|bell peppers?|peppers?|carrots?|celery|zucchini|broccoli|cauliflower|cabbage|green onions?|scallions?|jalapenos?|mushrooms?|cilantro|parsley|kale|squash)\b/;
const GRAIN = /\b(rice|quinoa|farro|barley)\b/;
const GROUND = /\b(ground (beef|turkey|chicken|pork)|bulk sausage|italian sausage|chorizo)\b/;
const SHRED = /\b(cooked chicken|shredded chicken|rotisserie)\b/;
const MAKE_AHEAD = /\b(casserole|soup|stew|chili|lasagna|enchilada|meatballs?|pozole|curry|bake)\b/;

const dayShort = (date: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// "2 onions", "1 bunch cilantro", "3 celery stalks", "garlic".
function vegAmount(k: string, n: number): string {
  if (k === "garlic") return "garlic";
  if (/^(cilantro|parsley|kale)$/.test(k)) return `${k}`;
  if (k === "celery") return `${n} celery stalk${n > 1 ? "s" : ""}`;
  if (/^(broccoli|cauliflower|cabbage|squash)$/.test(k)) return k;
  return `${n} ${k}${n > 1 && !/s$/.test(k) ? "s" : ""}`;
}
const vegName = (s: string) => s.replace(/s$/, "").replace(/^green onion$/, "green onion").replace(/^scallion$/, "green onion");

/**
 * One prep session that does the slow parts of the week's dinners ahead: rice, chopping, browning meat,
 * marinades, and whole make-ahead dinners. Weeknights then just finish and heat.
 */
export function prepPlan(days: PlanDay[], recipes: Map<string, RecipeLike>, prepWeekday: number, maxMinutes: number): PrepPlan | null {
  const prepDay = days.find((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === prepWeekday);
  if (!prepDay) return null;
  const dinners = days
    .filter((d) => d.recipeId && !d.leftoverOf && d.date >= prepDay.date)
    .map((d) => ({ d, r: recipes.get(d.recipeId!) }))
    .filter((x): x is { d: PlanDay; r: RecipeLike } => !!x.r);
  if (!dinners.length) return null;

  // Dinners made whole ahead of time need no separate chopping or browning.
  const wholeAhead = (d: PlanDay, r: RecipeLike) => d.date !== prepDay.date && (MAKE_AHEAD.test(plain(r.name)) || (r.tags ?? []).some((t) => t === "make-ahead" || t === "freezer"));
  const parts = dinners.filter(({ d, r }) => !wholeAhead(d, r));
  const label = (d: PlanDay, r: RecipeLike) => `${dayShort(d.date)} ${r.name.split(/ with | and /)[0]}`;
  const far = (d: PlanDay) => d.date > addDays(prepDay.date, 3); // cooked food keeps 3-4 days in the fridge
  const tasks: PrepTask[] = [];
  const saved: Record<string, number> = {};
  const save = (date: string, m: number) => { saved[date] = (saved[date] ?? 0) + m; };

  // Grains: cook all the rice at once.
  let cups = 0;
  const grainFor: string[] = [];
  for (const { d, r } of parts) {
    // In a one-pot dish the rice cooks in the pot.
    if ((r.tags ?? []).includes("one-pot") || /one-pot|skillet|soup|casserole|jambalaya|risotto|pilaf/.test(plain(r.name))) continue;
    for (const ing of r.ingredients) {
      const t = plain(ing.item);
      if (!GRAIN.test(t) || /cooked|leftover|vinegar|noodle|paper/.test(t)) continue;
      const a = parseAmount(ing.amount) ?? 1;
      cups += /cup/.test(plain(ing.unit)) ? a : 1;
      grainFor.push(label(d, r));
      save(d.date, 20);
    }
  }
  if (cups) tasks.push({ kind: "grain", title: `Cook ${Math.round(cups * 2) / 2} cups of rice`, detail: "Cool it, then refrigerate in a big container. Reheat with a splash of water.", minutes: 5, forDinners: [...new Set(grainFor)] });

  // Chopping: one cutting-board session for every dinner's vegetables.
  const chop = new Map<string, { count: number; for: Set<string> }>();
  for (const { d, r } of parts) {
    for (const ing of r.ingredients) {
      const t = plain(ing.item);
      const veg = t.match(VEG)?.[0];
      if (!veg || !(CHOPPED.test(t) || CHOPPED.test(plain(ing.unit)))) continue;
      const k = vegName(veg);
      const e = chop.get(k) ?? { count: 0, for: new Set<string>() };
      e.count += k === "garlic" ? 0.25 : Math.max(0.5, parseAmount(ing.amount) ?? 1);
      e.for.add(label(d, r));
      chop.set(k, e);
      save(d.date, k === "garlic" ? 2 : 4);
    }
  }
  if (chop.size) {
    const list = [...chop.entries()].map(([k, e]) => vegAmount(k, Math.ceil(e.count)));
    tasks.push({ kind: "chop", title: `Chop the week's vegetables`, detail: `${list.join(", ")}. Store each dinner's pile in its own container or bag, labeled.`, minutes: Math.min(45, 4 * chop.size + 4), forDinners: [...new Set([...chop.values()].flatMap((e) => [...e.for]))] });
  }

  // Ground meat: brown it all now.
  for (const { d, r } of parts) {
    const line = r.ingredients.find((i) => GROUND.test(plain(i.item)));
    if (!line) continue;
    tasks.push({ kind: "protein", title: `Brown the ${plain(line.item).match(GROUND)![0]} for ${dayShort(d.date)}`, detail: `${[line.amount, line.unit].filter(Boolean).join(" ")}. Drain, cool and refrigerate${far(d) ? " (or freeze, and thaw in the fridge the night before)" : ""}.`, minutes: 15, forDinners: [label(d, r)] });
    save(d.date, 12);
  }
  // Cooked/shredded chicken.
  for (const { d, r } of parts) {
    const line = r.ingredients.find((i) => SHRED.test(plain(i.item)));
    if (!line) continue;
    tasks.push({ kind: "protein", title: `Cook and shred chicken for ${dayShort(d.date)}`, detail: "Simmer or bake chicken breasts or thighs, then shred with two forks.", minutes: 30, forDinners: [label(d, r)] });
    save(d.date, 25);
  }
  // Marinades and other "the day before" steps.
  for (const { d, r } of dinners) {
    if (!r.prepAhead) continue;
    tasks.push({ kind: "marinate", title: `${dayShort(d.date)}: ${r.prepAhead.replace(/\.$/, "")}`, detail: far(d) ? "Bag it and freeze; it marinates as it thaws in the fridge the night before." : "Bag it and refrigerate.", minutes: 10, forDinners: [label(d, r)] });
  }
  // Whole make-ahead dinners.
  for (const { d, r } of dinners) {
    if (!wholeAhead(d, r)) continue;
    tasks.push({ kind: "assemble", title: `Make ${r.name} ahead`, detail: far(d) ? "Cook it fully, cool, and freeze. Thaw in the fridge the night before and reheat." : "Cook it fully, cool, and refrigerate. Reheat for dinner.", minutes: Math.min(60, Math.max(20, (r.totalMinutes ?? 40) - 10)), forDinners: [label(d, r)] });
    save(d.date, Math.max(0, (r.totalMinutes ?? 40) - 10));
  }

  // Fit the session in the time they have: rice, chopping and meat first, whole dinners if there's room.
  const order: PrepTask["kind"][] = ["grain", "chop", "protein", "marinate", "assemble"];
  tasks.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const now: PrepTask[] = [];
  const later: PrepTask[] = [];
  let total = 0;
  for (const t of tasks) {
    if (total + t.minutes <= maxMinutes) {
      now.push(t);
      total += t.minutes;
    } else later.push(t);
  }
  if (!now.length) return null;

  // How long each prepped dinner takes on the night.
  const finish: Record<string, number> = {};
  for (const { d, r } of dinners) {
    if (!saved[d.date] || d.date === prepDay.date) continue;
    const left = Math.max(10, Math.round(((r.totalMinutes ?? 40) - saved[d.date]) / 5) * 5);
    if (left <= 45) finish[d.date] = left; // only worth saying when the night really is quick
  }
  return { date: prepDay.date, minutes: total, tasks: now, later, finish };
}
