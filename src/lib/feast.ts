import type { Ingredient, PlanDay } from "./types";
import { scaleIngredient } from "./scaling";
import { addDays, dayName } from "./week";

/** One dish on a holiday menu. Amounts are for `servings` people; the feast scales them to the guest count. */
export type FeastDish = {
  key: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  ahead?: string; // what can be done the day before
  main?: boolean; // the turkey: sized by the guest count rather than scaled
  default: boolean; // on the menu unless they take it off
};

const i = (amount: string, unit: string, item: string): Ingredient => ({ amount, unit, item });

export const THANKSGIVING: FeastDish[] = [
  {
    key: "turkey", name: "Roast Turkey", servings: 10, main: true, default: true,
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
    ingredients: [i("1/4", "cup", "butter"), i("1/3", "cup", "all-purpose flour"), i("4", "cups", "chicken broth"), i("", "", "pan drippings from the turkey")],
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
    key: "pumpkin-pie", name: "Easy Pumpkin Pie", servings: 8, default: true,
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

export const FEAST_HOLIDAYS = ["Thanksgiving"] as const;
export const feastMenu = (holiday: string): FeastDish[] | null => (holiday === "Thanksgiving" ? THANKSGIVING : null);

export type Feast = NonNullable<PlanDay["feast"]>;

/** The turkey for this many people: about 1 1/4 lb a person (leftovers included), or a turkey breast for a small table. */
export function turkeyFor(guests: number): { kind: "whole turkey" | "bone-in turkey breast"; lb: number; thawDays: number; roastHours: number; two: boolean } {
  if (guests <= 6) {
    const lb = Math.max(4, Math.ceil(guests * 1));
    return { kind: "bone-in turkey breast", lb, thawDays: Math.max(1, Math.ceil(lb / 4)), roastHours: Math.round((lb * 20) / 60 * 2) / 2, two: false };
  }
  const total = Math.round(guests * 1.25);
  // Bigger than about 24 lb won't fit most ovens or roast evenly: two birds.
  const two = total > 24;
  const lb = Math.max(10, two ? Math.ceil(total / 2) : total);
  return { kind: "whole turkey", lb, thawDays: Math.ceil(lb / 4), roastHours: Math.round((lb * 13) / 60 * 2) / 2, two };
}

/** How much of each dish to make: guests / servings, rounded up to a half recipe. */
export const feastTimes = (dish: FeastDish, guests: number) => Math.max(0.5, Math.ceil((guests / dish.servings) * 2) / 2);

/** The chosen dishes with amounts for the guest count (the turkey line sized by turkeyFor). */
export function feastDishes(feast: Feast): (FeastDish & { scaled: Ingredient[]; times: number })[] {
  const menu = feastMenu(feast.holiday) ?? [];
  const t = turkeyFor(feast.guests);
  return menu
    .filter((d) => feast.dishes.includes(d.key))
    .map((d) => {
      const times = d.main ? 1 : feastTimes(d, feast.guests);
      const scaled = d.ingredients.map((ing) => {
        if (d.main && ing.item === "whole turkey") return { amount: t.two ? "2" : "1", unit: `(${t.lb} lb)`, item: t.kind };
        // The butter, aromatics and seasoning are for a 14 lb bird.
        if (d.main) return scaleTo(ing, Math.max(1, Math.round((t.lb / 14) * 2) / 2) * (t.two ? 2 : 1));
        return scaleTo(ing, times);
      });
      return { ...d, scaled, times };
    });
}

const scaleTo = (ing: Ingredient, m: number): Ingredient => (m === 1 || !ing.amount.trim() ? ing : scaleIngredient(ing, m));

export const FEAST_SECTION = (feast: Feast) => `${feast.holiday} dinner (${feast.guests} people)`;
export const isFeastSection = (name: string) => /^(thanksgiving) dinner \(\d+ people\)$/i.test(name);

/** Put the feast on its day. The dinner that was planned there makes way, and its leftovers nights become feast leftovers. */
export function withFeast(days: PlanDay[], index: number, feast: Feast): PlanDay[] {
  const day = days[index];
  const replaced = day.recipeId && !day.leftoverOf ? day.recipeName : null;
  return days.map((d, j) => {
    if (j === index) {
      return { ...d, feast: { ...feast, replaced: feast.replaced ?? replaced ?? null }, recipeId: null, recipeName: `${feast.holiday} dinner`, estimatedCost: null, reason: `${feast.holiday} dinner for ${feast.guests}`, saleItems: [], leftoverOf: null, batches: undefined, fromCook: null };
    }
    let next = d;
    if (d.leftoverOf === day.date) next = { ...next, recipeId: null, recipeName: `${feast.holiday} leftovers`, estimatedCost: 0, reason: "Turkey sandwiches and plates of everything" };
    if (j === index + 1 && d.lunch?.kind === "leftovers") next = { ...next, lunch: { ...d.lunch, recipeId: null, name: `${feast.holiday} leftovers`, reason: "Turkey sandwiches and leftovers from the feast" } };
    return next;
  });
}

/** The countdown: thaw, the day before, and the big day. */
export function feastTimeline(feast: Feast, date: string): { date: string; what: string }[] {
  const t = turkeyFor(feast.guests);
  const dishes = feastDishes(feast);
  const out: { date: string; what: string }[] = [];
  if (feast.dishes.includes("turkey") && feast.frozen) {
    out.push({ date: addDays(date, -t.thawDays), what: `Move the ${t.two ? "turkeys" : "turkey"} from the freezer to the fridge (in a pan, still wrapped). ${t.lb} lb takes about ${t.thawDays} day${t.thawDays === 1 ? "" : "s"} to thaw.` });
  }
  const ahead = dishes.filter((d) => d.ahead);
  if (ahead.length) out.push({ date: addDays(date, -1), what: ahead.map((d) => `${d.name}: ${d.ahead!.replace(/\.$/, "")}.`).join(" ") });
  if (feast.dishes.includes("turkey")) {
    const hours = (h: number) => (Number.isInteger(h) ? `${h}` : `${Math.floor(h)}½`);
    out.push({ date, what: `Turkey in the oven about ${hours(t.roastHours + 1)} hours before you want to eat (${hours(t.roastHours)} hours to roast, then 30 minutes to rest while the sides finish).` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** "Mon: Move the turkey…" tips for each day of the week, from the feast's countdown. */
export function feastTips(days: PlanDay[]): Map<string, string[]> {
  const tips = new Map<string, string[]>();
  for (const d of days) {
    if (!d.feast) continue;
    for (const step of feastTimeline(d.feast, d.date)) {
      if (step.date === d.date) continue;
      tips.set(step.date, [...(tips.get(step.date) ?? []), `🦃 For ${dayName(d.date)}: ${step.what}`]);
    }
  }
  return tips;
}
