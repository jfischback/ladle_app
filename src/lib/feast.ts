import type { Ingredient, PlanDay } from "./types";
import { scaleIngredient } from "./scaling";
import { parseAmount } from "./nutrition";
import { plural, singular } from "./grocery-merge";
import { addDays, dayName } from "./week";

/** One dish on a holiday menu. Amounts are for `servings` people; the feast scales them to the guest count. */
export type FeastDish = {
  key: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  ahead?: string; // what can be done the day before
  main?: "turkey" | "ham"; // the centerpiece: sized by the guest count rather than scaled
  whole?: boolean; // made in one pan (a pie): whole recipes only
  default: boolean; // on the menu unless they take it off
};

const i = (amount: string, unit: string, item: string): Ingredient => ({ amount, unit, item });

export const THANKSGIVING: FeastDish[] = [
  {
    key: "turkey", name: "Roast Turkey", servings: 10, main: "turkey", default: true,
    ingredients: [i("1", "", "whole turkey"), i("1/2", "cup", "butter, softened"), i("1", "", "yellow onion, quartered"), i("2", "stalks", "celery, cut in chunks"), i("1", "", "lemon, halved"), i("1", "bunch", "fresh thyme"), i("1", "tbsp", "kosher salt"), i("1", "tsp", "black pepper")],
    steps: [
      "Take the turkey out of the fridge 1 hour before roasting. Heat the oven to 325°F.",
      "Remove the neck and giblets from inside the turkey. Pat it very dry with paper towels.",
      "Rub the butter all over the skin and season with the salt and pepper. Put the onion, celery, lemon and thyme inside.",
      "Set the turkey breast-side up on a rack in a roasting pan. Tuck the wing tips under.",
      "Roast about 13 minutes per pound, until a thermometer in the thickest part of the thigh reads 165°F. Tent with foil if the skin browns too fast.",
      "Rest the turkey on a cutting board, loosely covered with foil, for 30 minutes before carving. Save the pan drippings for gravy.",
    ],
  },
  {
    key: "gravy", name: "Easy Turkey Gravy", servings: 10, default: true,
    ingredients: [i("1/2", "cup", "butter"), i("1/2", "cup", "all-purpose flour"), i("4", "cups", "chicken broth"), i("", "", "pan drippings from the turkey")],
    steps: [
      "Pour the turkey drippings into a measuring cup and let the fat rise to the top. Spoon off most of the fat.",
      "Melt the butter in a saucepan over medium heat. Whisk in the flour and cook 2 minutes, whisking.",
      "Slowly whisk in the broth and the drippings. Simmer 5 to 10 minutes, whisking, until thick. Season with salt and pepper.",
    ],
  },
  {
    key: "potatoes", name: "Creamy Mashed Potatoes", servings: 10, default: true,
    ingredients: [i("5", "lb", "russet potatoes"), i("1", "cup", "milk"), i("1/2", "cup", "butter"), i("2", "tsp", "kosher salt")],
    steps: [
      "Peel the potatoes and cut into 2-inch chunks. Cover with cold salted water in a big pot.",
      "Bring to a boil and cook 15 to 20 minutes, until a fork slides in easily. Drain well.",
      "Warm the milk and butter together. Mash the potatoes, then stir in the warm milk and butter and the salt.",
    ],
    ahead: "Peel and cut the potatoes; keep them covered in cold water in the fridge.",
  },
  {
    key: "stuffing", name: "Classic Stuffing", servings: 10, default: true,
    ingredients: [i("1", "(14 oz) bag", "dried bread stuffing cubes"), i("1/2", "cup", "butter"), i("1", "", "yellow onion, chopped"), i("3", "stalks", "celery, chopped"), i("2", "tsp", "poultry seasoning"), i("3", "cups", "chicken broth"), i("2", "", "eggs")],
    steps: [
      "Heat the oven to 350°F and butter a 9x13-inch baking dish.",
      "Melt the butter in a skillet and cook the onion and celery 8 minutes, until soft. Stir in the poultry seasoning.",
      "In a big bowl, toss the bread cubes with the vegetables. Whisk the broth and eggs and pour over, tossing until moist.",
      "Spread in the dish, cover with foil and bake 25 minutes. Uncover and bake 15 minutes more, until golden on top.",
    ],
    ahead: "Chop the onion and celery.",
  },
  {
    key: "green-beans", name: "Green Bean Casserole", servings: 8, default: true,
    ingredients: [i("2", "(14.5 oz) cans", "cut green beans, drained"), i("1", "(10.5 oz) can", "cream of mushroom soup"), i("3/4", "cup", "milk"), i("1", "(6 oz) can", "french fried onions"), i("1/4", "tsp", "black pepper")],
    steps: [
      "Heat the oven to 350°F.",
      "Stir the soup, milk and pepper together in a 1 1/2-quart baking dish. Stir in the green beans and half the fried onions.",
      "Bake 25 minutes, until bubbling. Top with the rest of the onions and bake 5 minutes more.",
    ],
  },
  {
    key: "sweet-potatoes", name: "Sweet Potato Casserole", servings: 8, default: false,
    ingredients: [i("3", "lb", "sweet potatoes"), i("1/3", "cup", "brown sugar"), i("4", "tbsp", "butter, melted"), i("1", "tsp", "ground cinnamon"), i("2", "cups", "mini marshmallows")],
    steps: [
      "Heat the oven to 375°F. Peel the sweet potatoes, cut into chunks and boil 15 minutes, until tender. Drain.",
      "Mash with the brown sugar, butter and cinnamon. Spread in a buttered baking dish.",
      "Top with the marshmallows and bake 20 minutes, until puffed and golden.",
    ],
    ahead: "Make the mashed sweet potatoes and keep them covered in the fridge; add the marshmallows right before baking.",
  },
  {
    key: "cranberry", name: "Cranberry Sauce", servings: 10, default: true,
    ingredients: [i("1", "(12 oz) bag", "fresh cranberries"), i("1", "cup", "sugar"), i("1", "cup", "orange juice")],
    steps: [
      "Bring the sugar and orange juice to a boil in a saucepan, stirring until the sugar dissolves.",
      "Add the cranberries and simmer 10 minutes, until most of them pop.",
      "Cool, then chill. It thickens as it cools.",
    ],
    ahead: "Make it completely: it keeps in the fridge for up to a week.",
  },
  {
    key: "rolls", name: "Dinner Rolls", servings: 12, default: true,
    ingredients: [i("12", "", "dinner rolls"), i("2", "tbsp", "butter, melted")],
    steps: ["Warm the rolls in a 350°F oven for 8 to 10 minutes while the turkey rests. Brush with melted butter."],
  },
  {
    key: "pumpkin-pie", name: "Easy Pumpkin Pie", servings: 8, default: true, whole: true,
    ingredients: [i("1", "", "refrigerated pie crust"), i("1", "(15 oz) can", "pumpkin puree"), i("1", "(12 oz) can", "evaporated milk"), i("2", "", "eggs"), i("3/4", "cup", "sugar"), i("1 1/2", "tsp", "pumpkin pie spice")],
    steps: [
      "Heat the oven to 425°F. Fit the crust into a 9-inch pie plate.",
      "Whisk the pumpkin, evaporated milk, eggs, sugar and pumpkin pie spice until smooth. Pour into the crust.",
      "Bake 15 minutes, then lower the oven to 350°F and bake 40 to 50 minutes more, until a knife near the center comes out clean.",
      "Cool on a rack for 2 hours. Serve with whipped cream.",
    ],
    ahead: "Bake it: pie is best made the day before and kept in the fridge.",
  },
];

const dish = (key: string) => THANKSGIVING.find((d) => d.key === key)!;

export const CHRISTMAS: FeastDish[] = [
  {
    key: "ham", name: "Brown Sugar Glazed Ham", servings: 12, main: "ham", default: true,
    ingredients: [i("1", "", "spiral-cut ham"), i("1/2", "cup", "brown sugar"), i("2", "tbsp", "honey"), i("2", "tbsp", "Dijon mustard"), i("1/4", "cup", "orange juice")],
    steps: [],
  },
  dish("potatoes"),
  dish("green-beans"),
  {
    key: "mac", name: "Baked Mac and Cheese", servings: 8, default: true, whole: true,
    ingredients: [i("1", "lb", "elbow macaroni"), i("4", "tbsp", "butter"), i("1/4", "cup", "all-purpose flour"), i("3", "cups", "milk"), i("3", "cups", "shredded sharp cheddar cheese"), i("1", "tsp", "kosher salt"), i("1/2", "tsp", "dry mustard")],
    steps: [
      "Heat the oven to 350°F and butter a 9x13-inch baking dish. Cook the macaroni 2 minutes less than the box says; drain.",
      "Melt the butter in a big pot, whisk in the flour and cook 1 minute. Slowly whisk in the milk and simmer 5 minutes, whisking, until it thickens.",
      "Off the heat, stir in 2 1/2 cups of the cheese, the salt and dry mustard until smooth. Stir in the macaroni.",
      "Spread in the dish, top with the rest of the cheese and bake 25 minutes, until bubbling.",
    ],
    ahead: "Make it up to the baking and keep it covered in the fridge; add 10 minutes to the baking.",
  },
  {
    key: "carrots", name: "Honey Roasted Carrots", servings: 8, default: true,
    ingredients: [i("3", "lb", "carrots, peeled and cut in sticks"), i("3", "tbsp", "olive oil"), i("2", "tbsp", "honey"), i("1", "tsp", "kosher salt")],
    steps: [
      "Heat the oven to 425°F. Toss the carrots with the oil and salt on two sheet pans.",
      "Roast 25 minutes, stirring once. Drizzle with the honey, toss, and roast 5 minutes more.",
    ],
    ahead: "Peel and cut the carrots; keep them in a bag in the fridge.",
  },
  dish("rolls"),
  {
    key: "apple-crisp", name: "Easy Apple Crisp", servings: 8, default: true, whole: true,
    ingredients: [i("6", "", "apples, peeled and sliced"), i("1/2", "cup", "sugar"), i("1", "tsp", "ground cinnamon"), i("1", "cup", "old-fashioned oats"), i("3/4", "cup", "all-purpose flour"), i("3/4", "cup", "brown sugar"), i("1/2", "cup", "butter, melted")],
    steps: [
      "Heat the oven to 350°F. Toss the apples with the sugar and cinnamon in a 9x13-inch baking dish.",
      "Stir the oats, flour, brown sugar and melted butter together until crumbly; scatter over the apples.",
      "Bake 45 minutes, until golden and bubbling. Serve warm, with vanilla ice cream if you like.",
    ],
    ahead: "Mix the crumble topping and keep it covered in the fridge.",
  },
];

export const FEAST_HOLIDAYS = ["Thanksgiving", "Christmas Day"] as const;
export const feastMenu = (holiday: string): FeastDish[] | null => (holiday === "Thanksgiving" ? THANKSGIVING : holiday === "Christmas Day" ? CHRISTMAS : null);
/** "Christmas Day" -> "Christmas": how the dinner is named ("Christmas dinner", "Christmas leftovers"). */
export const feastLabel = (holiday: string) => holiday.replace(/ Day$/, "");
export const feastIcon = (holiday: string) => (/christmas/i.test(holiday) ? "🎄" : "🦃");

export type Feast = NonNullable<PlanDay["feast"]>;

// USDA roasting times at 325°F, unstuffed (upper end, in hours): [up to this many lb, hours].
const WHOLE_HOURS: [number, number][] = [[12, 3], [14, 3.75], [18, 4.25], [20, 4.5], [24, 5]];
const BREAST_HOURS: [number, number][] = [[6, 2.25], [8, 3.25]];
const hoursFor = (table: [number, number][], lb: number) => (table.find(([max]) => lb <= max) ?? table[table.length - 1])[1];

/** The turkey for this many people: about 1 1/4 lb a person (leftovers included), or a turkey breast for a small table. */
export function turkeyFor(guests: number): { kind: "whole turkey" | "bone-in turkey breast"; lb: number; thawDays: number; roastHours: number; two: boolean } {
  if (guests <= 6) {
    const lb = Math.min(8, Math.max(4, Math.ceil(guests)));
    return { kind: "bone-in turkey breast", lb, thawDays: Math.max(1, Math.ceil(lb / 4)), roastHours: hoursFor(BREAST_HOURS, lb), two: false };
  }
  const total = Math.round(guests * 1.25);
  // Bigger than about 24 lb won't fit most ovens or roast evenly: two birds, each no more than 24 lb.
  const two = total > 24;
  const lb = Math.min(24, Math.max(10, two ? Math.ceil(total / 2) : total));
  return { kind: "whole turkey", lb, thawDays: Math.ceil(lb / 4), roastHours: hoursFor(WHOLE_HOURS, lb), two };
}

/** The ham: about 1/2 to 3/4 lb a person bone-in (leftovers included); fully cooked, so it's warmed, not thawed. */
export function hamFor(guests: number): { kind: "spiral-cut ham"; lb: number; two: boolean; roastHours: number } {
  const total = Math.max(6, Math.round(guests * 0.6));
  // Spiral hams come up to about 12 lb: past that, two.
  const two = total > 12;
  const lb = Math.min(12, two ? Math.ceil(total / 2) : total);
  // USDA: a fully cooked spiral ham at 325°F, 10 to 14 minutes a pound (the upper end, to the nearest quarter hour).
  return { kind: "spiral-cut ham", lb, two, roastHours: Math.ceil(((lb * 14) / 60) * 4) / 4 };
}

/** The feast's centerpiece, whichever it is: what it is, how big, how long it needs, and whether it thaws. */
export function mainFor(feast: Feast): { noun: "turkey" | "ham"; kind: string; lb: number; two: boolean; roastHours: number; thawDays: number | null } | null {
  const menu = feastMenu(feast.holiday) ?? [];
  const main = menu.find((d) => d.main && feast.dishes.includes(d.key));
  if (!main) return null;
  if (main.main === "ham") return { noun: "ham", thawDays: null, ...hamFor(feast.guests) };
  const t = turkeyFor(feast.guests);
  return { noun: "turkey", kind: t.kind, lb: t.lb, two: t.two, roastHours: t.roastHours, thawDays: t.thawDays };
}

const hoursText = (h: number) => {
  const whole = Math.floor(h);
  const part = h - whole;
  const frac = part === 0.25 ? "¼" : part === 0.5 ? "½" : part === 0.75 ? "¾" : "";
  return `${whole || ""}${frac}` || "0";
};

/** The turkey's steps, for a whole bird or a breast (the thermometer goes in a different place). */
function turkeySteps(t: ReturnType<typeof turkeyFor>): string[] {
  const breast = t.kind === "bone-in turkey breast";
  return [
    `Take the ${breast ? "turkey breast" : "turkey"} out of the fridge 1 hour before roasting. Heat the oven to 325°F.`,
    breast ? "Pat the turkey breast very dry with paper towels." : "Remove the neck and giblets from inside the turkey. Pat it very dry with paper towels.",
    breast
      ? "Rub the butter all over the skin and season with the salt and pepper. Set it skin-side up on the onion, celery, lemon and thyme in a roasting pan."
      : "Rub the butter all over the skin and season with the salt and pepper. Put the onion, celery, lemon and thyme inside.",
    breast ? "Roast, uncovered." : "Set the turkey breast-side up on a rack in a roasting pan. Tuck the wing tips under.",
    `Roast about ${hoursText(t.roastHours)} hours, until a thermometer in the thickest part of the ${breast ? "breast (not touching the bone)" : "thigh (not touching the bone)"} reads 165°F. Start checking 45 minutes early, and tent with foil if the skin browns too fast.`,
    `Rest the ${breast ? "breast" : "turkey"} on a cutting board, loosely covered with foil, for 30 minutes before carving. Save the pan drippings for gravy.`,
    ...(t.two ? ["Two turkeys: roast them in two ovens, or roast one the day before, carve it, and keep the meat in the fridge to warm with a little broth."] : []),
  ];
}

/** The ham's steps. */
function hamSteps(h: ReturnType<typeof hamFor>): string[] {
  return [
    `Take the ham out of the fridge 1 hour before. Heat the oven to 325°F.`,
    "Set the ham cut-side down in a roasting pan, add 1/2 cup water to the pan and cover it tightly with foil.",
    `Warm it about ${hoursText(h.roastHours)} hours (10 to 14 minutes a pound), until a thermometer in the thickest part (not touching the bone) reads 140°F.`,
    "Stir the brown sugar, honey, mustard and orange juice together.",
    "Uncover the ham, turn the oven up to 400°F, brush on the glaze and bake 10 to 15 minutes, brushing once more, until glossy.",
    "Rest 10 minutes, then slice along the spiral cuts.",
    ...(h.two ? ["Two hams: warm them side by side in a big oven, or one in each oven."] : []),
  ];
}

/** How much of each dish to make: guests / servings, rounded up to a half recipe (at least one whole one; pies whole). */
export const feastTimes = (dish: FeastDish, guests: number) => {
  const n = guests / dish.servings;
  return dish.whole ? Math.max(1, Math.ceil(n)) : Math.max(1, Math.ceil(n * 2) / 2);
};

/** "4 (12 oz) bag" -> "4 (12 oz) bags", "1 cups" -> "1 cup": the unit agrees with the amount. */
export function agree(amount: string, unit: string): string {
  const n = parseAmount(amount);
  if (n == null || !unit) return unit;
  const m = unit.match(/^(.*?)(\w+)$/);
  if (!m) return unit;
  const [, before, word] = m;
  if (/^(oz|lb|lbs|tsp|tbsp|g|kg|ml)$/i.test(word)) return unit;
  return before + (n > 1 ? plural(singular(word)) : singular(word));
}

/** The chosen dishes with amounts for the guest count (the turkey line sized by turkeyFor). */
export function feastDishes(feast: Feast): (FeastDish & { scaled: Ingredient[]; times: number })[] {
  const menu = feastMenu(feast.holiday) ?? [];
  const t = turkeyFor(feast.guests);
  const h = hamFor(feast.guests);
  const hasTurkey = feast.dishes.includes("turkey");
  return menu
    // Gravy is made from the turkey's drippings.
    .filter((d) => feast.dishes.includes(d.key) && (d.key !== "gravy" || hasTurkey))
    .map((d) => {
      const times = d.main ? 1 : feastTimes(d, feast.guests);
      const big = d.main === "ham" ? { ...h, base: 9, item: "spiral-cut ham" } : { ...t, base: 14, item: "whole turkey" };
      const scaled = d.ingredients.map((ing) => {
        if (d.main && ing.item === big.item) return { amount: big.two ? "2" : "1", unit: `(${big.lb} lb)`, item: big.kind };
        // The rest (butter and aromatics, or the glaze) is for a 14 lb bird or a 9 lb ham.
        const one = d.main ? scaleTo(ing, Math.max(0.5, Math.round((big.lb / big.base) * 2) / 2) * (big.two ? 2 : 1)) : scaleTo(ing, times);
        return { ...one, unit: agree(one.amount, one.unit) };
      });
      return { ...d, scaled, times, steps: d.main === "ham" ? hamSteps(h) : d.main ? turkeySteps(t) : d.steps };
    });
}

const scaleTo = (ing: Ingredient, m: number): Ingredient => (m === 1 || !ing.amount.trim() ? ing : scaleIngredient(ing, m));

// The section keeps the same name when the guest count changes, so ticks made while shopping stay put.
export const FEAST_SECTION = (feast: Feast) => `${feastLabel(feast.holiday)} dinner`;
export const isFeastSection = (name: string) => /^(thanksgiving|christmas) dinner( \(\d+ people\))?$/i.test(name);

/** Lunches that were leftovers of a dinner no longer cooked the night before become open lunches. */
function fixLeftoverLunches(days: PlanDay[]): PlanDay[] {
  return days.map((d, i) => {
    const l = d.lunch;
    if (!l || l.kind !== "leftovers" || i === 0) return d;
    const prev = days[i - 1];
    const feastBefore = prev.feast || (prev.leftoverOf && !prev.recipeId && days.some((x) => x.date === prev.leftoverOf && x.feast));
    if (l.recipeId === null ? feastBefore : prev.recipeId === l.recipeId) return d;
    if (feastBefore) return { ...d, lunch: { ...l, recipeId: null, name: `${feastLabel(feastName(days))} leftovers`, reason: "Sandwiches and plates of everything from the feast" } };
    return { ...d, lunch: { ...l, kind: "open", recipeId: null, name: "Lunch: your pick", reason: "The dinner these leftovers came from changed" } };
  });
}
const feastName = (days: PlanDay[]) => days.find((d) => d.feast)?.feast?.holiday ?? "Holiday";

/** Put the feast on its day. The dinner that was planned there makes way, and its leftovers nights become feast leftovers. */
export function withFeast(days: PlanDay[], index: number, feast: Feast): PlanDay[] {
  const day = days[index];
  const replacing = day.recipeId && !day.leftoverOf ? { id: day.recipeId, name: day.recipeName } : null;
  const next = days.map((d, j) => {
    if (j === index) {
      return {
        ...d,
        feast: { ...feast, replaced: feast.replaced ?? replacing?.name ?? null, replacedId: feast.replacedId ?? replacing?.id ?? null },
        recipeId: null, recipeName: `${feastLabel(feast.holiday)} dinner`, estimatedCost: null, reason: `${feastLabel(feast.holiday)} dinner for ${feast.guests}`, saleItems: [], leftoverOf: null, batches: undefined, fromCook: null,
      };
    }
    if (d.leftoverOf === day.date) return { ...d, recipeId: null, recipeName: `${feastLabel(feast.holiday)} leftovers`, estimatedCost: 0, reason: `${mainFor(feast)?.noun === "ham" ? "Ham" : "Turkey"} sandwiches and plates of everything` };
    return d;
  });
  return fixLeftoverLunches(dropOrphanBatches(next));
}

/** A cooking night whose leftovers night just became the feast doesn't need a double batch any more. */
function dropOrphanBatches(days: PlanDay[]): PlanDay[] {
  return days.map((d) => {
    if (!d.batches || d.batches < 2 || !d.recipeId || d.leftoverOf) return d;
    const want = 1 + days.filter((x) => x.leftoverOf === d.date && x.recipeId === d.recipeId).length;
    if (want >= d.batches) return d;
    const cost = d.estimatedCost != null ? Math.round((d.estimatedCost / d.batches) * want * 100) / 100 : null;
    return { ...d, batches: want > 1 ? want : undefined, estimatedCost: cost, reason: want > 1 ? d.reason : d.reason.replace(/ · double batch for \w+/, "") };
  });
}

/** Take the feast off: the dinner it replaced comes back (or a night off), its leftovers night becomes a night off. */
export function withoutFeast(days: PlanDay[], index: number): PlanDay[] {
  const day = days[index];
  if (!day?.feast) return days;
  const back = day.feast.replacedId && day.feast.replaced ? { recipeId: day.feast.replacedId, recipeName: day.feast.replaced, reason: "Back on the plan" } : { recipeId: null, recipeName: null, reason: "No-cook night" };
  const next = days.map((d, j) => {
    if (j === index) return { ...d, feast: null, ...back, estimatedCost: null };
    if (d.leftoverOf === day.date && !d.recipeId) return { ...d, leftoverOf: null, recipeName: null, reason: "No-cook night", estimatedCost: null };
    return d;
  });
  return fixLeftoverLunches(next);
}

/**
 * The countdown: thaw, the day before, and the big day. `boughtOn` is the shopping day (when the turkey comes home)
 * and `today` the current date: a frozen turkey can't start thawing before either.
 */
export function feastTimeline(feast: Feast, date: string, opts: { boughtOn?: string; today?: string } = {}): { date: string; what: string }[] {
  const t = turkeyFor(feast.guests);
  const dishes = feastDishes(feast);
  const out: { date: string; what: string }[] = [];
  const birds = t.two ? "turkeys" : "turkey";
  if (feast.dishes.includes("turkey") && feast.frozen) {
    const thaw = addDays(date, -t.thawDays);
    const earliest = [opts.boughtOn, opts.today].filter((x): x is string => !!x).sort().pop();
    if (earliest && thaw < earliest) {
      // Not enough days in the fridge: say so plainly, with the safe ways to do it.
      out.push({ date: earliest, what: `A frozen ${t.lb} lb ${t.kind} needs about ${t.thawDays} days in the fridge, and there isn't time. Buy a fresh (not frozen) ${birds === "turkeys" ? "pair" : "one"}, or thaw it in cold water in the sink: about 30 minutes a pound (around ${hoursText(Math.ceil((t.lb * 0.5) * 2) / 2)} hours), still wrapped, changing the water every 30 minutes, then roast it right away. Never thaw it on the counter.` });
    } else {
      out.push({ date: thaw, what: `Move the ${birds} from the freezer to the fridge (in a pan, still wrapped). ${t.lb} lb takes about ${t.thawDays} day${t.thawDays === 1 ? "" : "s"} to thaw.` });
    }
  }
  const ahead = dishes.filter((d) => d.ahead);
  if (ahead.length) out.push({ date: addDays(date, -1), what: ahead.map((d) => `${d.name}: ${d.ahead!.replace(/\.$/, "")}.`).join(" ") });
  const main = mainFor(feast);
  if (main?.noun === "turkey") {
    out.push({ date, what: `Take the ${birds} out of the fridge ${hoursText(t.roastHours + 1.5)} hours before you want to eat, and into the oven an hour later: about ${hoursText(t.roastHours)} hours to roast, then 30 minutes to rest while the sides finish.` });
  } else if (main?.noun === "ham") {
    const hams = main.two ? "hams" : "ham";
    out.push({ date, what: `Take the ${hams} out of the fridge ${hoursText(main.roastHours + 1.5)} hours before you want to eat, and into the oven an hour later: about ${hoursText(main.roastHours)} hours to warm and glaze, then 10 minutes to rest.` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** "Mon: Move the turkey…" tips for each day of the week, from the feast's countdown. */
export function feastTips(days: PlanDay[], opts: { boughtOn?: string; today?: string } = {}): Map<string, string[]> {
  const tips = new Map<string, string[]>();
  for (const d of days) {
    if (!d.feast) continue;
    for (const step of feastTimeline(d.feast, d.date, opts)) {
      if (step.date === d.date) continue;
      tips.set(step.date, [...(tips.get(step.date) ?? []), `${feastIcon(d.feast.holiday)} For ${dayName(d.date)}: ${step.what}`]);
    }
  }
  return tips;
}
