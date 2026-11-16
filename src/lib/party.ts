import type { Ingredient } from "./types";
import { scaleIngredient } from "./scaling";
import { addDays } from "./week";
import { agree } from "./feast";

/** Party food: boards, trays, apps, simple mains, sweets and drinks, scaled to the crowd. */
export type PartyCourse = "board" | "app" | "main" | "side" | "sweet" | "drink";
export type PartyDish = {
  key: string;
  name: string;
  icon: string;
  course: PartyCourse;
  /** How many guests one recipe feeds when it's one of several things on the table. */
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  /** What can be done the day before. */
  ahead?: string;
  /** A store-bought shortcut, for busy hosts. */
  shortcut?: string;
  /** Bought or baked whole (a cake, a tray): whole recipes only. */
  whole?: boolean;
};

export const COURSES: { key: PartyCourse; label: string }[] = [
  { key: "board", label: "Boards and trays" },
  { key: "app", label: "Bites and appetizers" },
  { key: "main", label: "Something hearty" },
  { key: "side", label: "Sides and salads" },
  { key: "sweet", label: "Sweets" },
  { key: "drink", label: "Drinks" },
];

const i = (amount: string, unit: string, item: string): Ingredient => ({ amount, unit, item });

export const PARTY_DISHES: PartyDish[] = [
  {
    key: "charcuterie", name: "Meat and cheese board", icon: "🧀", course: "board", servings: 12,
    ingredients: [i("8", "oz", "sliced salami"), i("4", "oz", "prosciutto"), i("8", "oz", "sharp cheddar block"), i("8", "oz", "brie wheel"), i("8", "oz", "gouda block"), i("2", "boxes", "assorted crackers"), i("1", "lb", "red grapes"), i("6", "oz", "dried apricots"), i("1", "jar", "fig jam"), i("1", "jar", "green olives"), i("1", "jar", "cornichons")],
    steps: ["Cut the hard cheeses into slices or cubes; leave the brie whole with a knife beside it.", "Fold or roll the meats and tuck them around the cheeses on a big board or tray.", "Fill the gaps with crackers, grapes, apricots, olives and pickles, with the jam in a small bowl.", "Set it out about 30 minutes before guests come so the cheese softens."],
    ahead: "Cube the cheeses and wash the grapes; keep them covered in the fridge.",
    shortcut: "Or pick up a deli meat and cheese tray and add crackers and grapes.",
  },
  {
    key: "veggie-tray", name: "Veggie tray with ranch dip", icon: "🥕", course: "board", servings: 12,
    ingredients: [i("1", "lb", "baby carrots"), i("1", "bunch", "celery"), i("2", "", "cucumbers"), i("1", "pint", "cherry tomatoes"), i("1", "head", "broccoli"), i("2", "", "bell peppers"), i("2", "cups", "sour cream"), i("1", "packet", "ranch seasoning mix")],
    steps: ["Stir the ranch seasoning into the sour cream and chill it at least an hour.", "Cut the celery, cucumbers and peppers into sticks and the broccoli into small florets.", "Arrange everything around the bowl of dip."],
    ahead: "Make the dip and cut the vegetables; store them in containers with a damp paper towel.",
    shortcut: "Or grab a ready-made veggie tray from the produce section.",
  },
  {
    key: "fruit-platter", name: "Fruit platter", icon: "🍓", course: "board", servings: 12,
    ingredients: [i("2", "lb", "strawberries"), i("1", "", "pineapple"), i("2", "lb", "green grapes"), i("1", "pint", "blueberries"), i("1", "", "cantaloupe")],
    steps: ["Cut the pineapple and cantaloupe into chunks and halve the big strawberries.", "Pile the fruit in sections on a platter, berries last so they stay neat."],
    ahead: "Cut the melon and pineapple; keep the berries whole until the day.",
    shortcut: "Or buy a cut fruit tray.",
  },
  {
    key: "meatballs", name: "Sweet and tangy meatballs", icon: "🍢", course: "app", servings: 12,
    ingredients: [i("2", "lb", "frozen cooked meatballs"), i("1", "cup", "grape jelly"), i("1", "(12 oz) bottle", "chili sauce")],
    steps: ["Whisk the jelly and chili sauce in a slow cooker.", "Add the frozen meatballs and stir to coat.", "Cook on low 4 hours or high 2 hours, stirring once, until hot (165 F). Keep on warm with toothpicks beside it."],
  },
  {
    key: "caprese", name: "Caprese skewers", icon: "🍅", course: "app", servings: 12,
    ingredients: [i("1", "pint", "cherry tomatoes"), i("8", "oz", "fresh mozzarella pearls"), i("1", "bunch", "fresh basil"), i("1", "bottle", "balsamic glaze"), i("1", "pack", "toothpicks")],
    steps: ["Thread a tomato, a folded basil leaf and a mozzarella pearl onto each toothpick.", "Lay them on a platter and drizzle with balsamic glaze just before serving."],
    ahead: "Build the skewers and chill them, covered; glaze them when they go out.",
  },
  {
    key: "pinwheels", name: "Ham and cheese pinwheels", icon: "🌀", course: "app", servings: 12,
    ingredients: [i("6", "", "large flour tortillas"), i("8", "oz", "cream cheese, softened"), i("8", "oz", "sliced deli ham"), i("1", "cup", "shredded cheddar"), i("1", "cup", "baby spinach")],
    steps: ["Spread cream cheese all the way to the edges of each tortilla.", "Layer ham, a sprinkle of cheddar and a few spinach leaves.", "Roll up tightly, wrap in plastic and chill at least an hour.", "Slice into 1-inch rounds."],
    ahead: "Roll and wrap them the day before; slice the day of.",
  },
  {
    key: "deviled-eggs", name: "Deviled eggs", icon: "🥚", course: "app", servings: 12,
    ingredients: [i("12", "", "eggs"), i("1/2", "cup", "mayonnaise"), i("2", "tsp", "yellow mustard"), i("1", "tsp", "paprika")],
    steps: ["Hard-boil the eggs (12 minutes), cool them in ice water and peel.", "Halve them, pop the yolks into a bowl and mash with the mayonnaise, mustard and a pinch of salt.", "Spoon or pipe the filling back in and dust with paprika. Keep them cold."],
    ahead: "Boil and peel the eggs and make the filling; fill them the day of.",
  },
  {
    key: "wings", name: "Buffalo wings", icon: "🍗", course: "app", servings: 12,
    ingredients: [i("4", "lb", "chicken wings"), i("1", "(12 oz) bottle", "buffalo wing sauce"), i("1", "(16 oz) bottle", "blue cheese dressing"), i("1", "bunch", "celery")],
    steps: ["Heat the oven to 425 F. Pat the wings very dry and spread them on racks over foil-lined pans.", "Bake 45 to 50 minutes, turning once, until crisp and 175 F inside.", "Toss with the wing sauce and serve with dressing and celery sticks."],
  },
  {
    key: "chips-salsa", name: "Chips, salsa and guacamole", icon: "🥑", course: "app", servings: 12,
    ingredients: [i("2", "(13 oz) bags", "tortilla chips"), i("2", "(16 oz) jars", "salsa"), i("4", "", "ripe avocados"), i("2", "", "limes"), i("1/4", "cup", "chopped red onion")],
    steps: ["Mash the avocados with the lime juice, onion and a good pinch of salt.", "Put out the chips with bowls of salsa and guacamole."],
    shortcut: "Or buy ready-made guacamole.",
  },
  {
    key: "sliders", name: "Cheeseburger sliders", icon: "🍔", course: "main", servings: 12,
    ingredients: [i("24", "", "slider buns"), i("3", "lb", "ground beef"), i("12", "slices", "cheddar cheese"), i("1", "jar", "dill pickle chips"), i("1", "bottle", "ketchup")],
    steps: ["Press the beef into an even layer on a sheet pan, season with salt and pepper, and bake at 400 F for about 15 minutes, until 160 F.", "Drain, lay the cheese over the top and return 2 minutes to melt.", "Cut into squares to fit the buns and set out the pickles and ketchup."],
  },
  {
    key: "sub-platter", name: "Sub sandwich platter", icon: "🥖", course: "main", servings: 12,
    ingredients: [i("6", "", "hoagie rolls"), i("1 1/2", "lb", "sliced deli turkey"), i("12", "slices", "provolone"), i("1", "head", "lettuce"), i("3", "", "tomatoes"), i("1", "jar", "mayonnaise")],
    steps: ["Split the rolls and layer turkey, provolone, lettuce and sliced tomato.", "Cut each sub into 3 or 4 pieces and hold them with toothpicks."],
    shortcut: "Or order a party sub from the deli.",
  },
  {
    key: "baked-ziti", name: "Baked ziti", icon: "🍝", course: "main", servings: 12,
    ingredients: [i("2", "lb", "ziti pasta"), i("2", "(24 oz) jars", "marinara sauce"), i("1", "(15 oz) container", "ricotta cheese"), i("4", "cups", "shredded mozzarella"), i("1", "cup", "grated parmesan")],
    steps: ["Boil the ziti 2 minutes short of the package time and drain.", "Mix it with the marinara, dollops of ricotta and half the mozzarella in a big baking dish.", "Top with the rest of the mozzarella and the parmesan. Bake at 375 F about 30 minutes, until bubbling."],
    ahead: "Assemble it the day before and keep it covered in the fridge; add 15 minutes to the bake.",
  },
  {
    key: "pasta-salad", name: "Italian pasta salad", icon: "🥗", course: "side", servings: 12,
    ingredients: [i("1", "lb", "rotini pasta"), i("1", "(16 oz) bottle", "Italian dressing"), i("1", "pint", "cherry tomatoes"), i("1", "", "cucumber"), i("1", "(6 oz) can", "sliced black olives"), i("8", "oz", "mozzarella cubes"), i("1/2", "", "red onion")],
    steps: ["Cook the pasta, rinse it in cold water and drain well.", "Toss with the halved tomatoes, diced cucumber, olives, mozzarella, thinly sliced onion and most of the dressing.", "Chill, then stir in the last of the dressing before serving."],
    ahead: "Make it the day before; it tastes better.",
  },
  {
    key: "sheet-cake", name: "Bakery sheet cake", icon: "🎂", course: "sweet", servings: 30, whole: true,
    ingredients: [i("1", "", "bakery half-sheet cake")],
    steps: ["Order it from the bakery a few days ahead with the name or message you want.", "Pick it up the day before or the morning of."],
    ahead: "Pick up the cake.",
  },
  {
    key: "cupcakes", name: "Cupcakes", icon: "🧁", course: "sweet", servings: 24, whole: true,
    ingredients: [i("1", "box", "cake mix"), i("3", "", "eggs"), i("1/2", "cup", "vegetable oil"), i("2", "tubs", "frosting"), i("1", "jar", "sprinkles"), i("1", "pack", "cupcake liners")],
    steps: ["Make the batter as the box says and bake in lined muffin pans.", "Cool completely, then frost and add sprinkles."],
    ahead: "Bake and frost them the day before; keep covered at room temperature.",
    shortcut: "Or buy a dozen from the bakery.",
  },
  {
    key: "cookie-tray", name: "Cookie tray", icon: "🍪", course: "sweet", servings: 24, whole: true,
    ingredients: [i("2", "dozen", "bakery cookies")],
    steps: ["Arrange the cookies on a tray, mixing the kinds."],
  },
  {
    key: "cocoa-bar", name: "Hot cocoa bar", icon: "☕", course: "drink", servings: 12,
    ingredients: [i("12", "packets", "hot cocoa mix"), i("1", "bag", "mini marshmallows"), i("1", "can", "whipped cream"), i("1", "box", "candy canes")],
    steps: ["Keep hot water or milk warm in a slow cooker.", "Set out mugs, cocoa packets and bowls of toppings."],
  },
  {
    key: "lemonade", name: "Lemonade and iced tea", icon: "🍋", course: "drink", servings: 12,
    ingredients: [i("1", "gallon", "lemonade"), i("1", "gallon", "iced tea"), i("1", "bag", "ice")],
    steps: ["Chill the drinks and put them out in pitchers or a drink dispenser with a bucket of ice."],
  },
  {
    key: "water-soda", name: "Water and sodas", icon: "🥤", course: "drink", servings: 12,
    ingredients: [i("1", "(12 pack)", "sparkling water"), i("1", "(12 pack)", "soda"), i("1", "(24 pack)", "bottled water"), i("1", "bag", "ice")],
    steps: ["Fill a cooler or tub with ice and bury the cans and bottles in it."],
  },
  {
    key: "coffee", name: "Coffee and tea", icon: "🫖", course: "drink", servings: 15,
    ingredients: [i("12", "oz", "ground coffee"), i("1", "(32 oz) bottle", "coffee creamer"), i("1", "box", "tea bags"), i("1", "box", "sugar packets")],
    steps: ["Brew coffee in a big pot or borrowed urn and keep hot water ready for tea.", "Set out cups, creamer, sugar and stirrers."],
  },
];

export const PARTY_KINDS = [
  { key: "birthday", label: "Birthday", icon: "🎂", dishes: ["veggie-tray", "fruit-platter", "pinwheels", "sliders", "chips-salsa", "sheet-cake", "lemonade"] },
  { key: "graduation", label: "Graduation", icon: "🎓", dishes: ["charcuterie", "veggie-tray", "fruit-platter", "sub-platter", "pasta-salad", "meatballs", "sheet-cake", "water-soda"] },
  { key: "celebration-of-life", label: "Celebration of life", icon: "🕊️", dishes: ["sub-platter", "veggie-tray", "fruit-platter", "deviled-eggs", "pasta-salad", "cookie-tray", "coffee", "lemonade"] },
  { key: "christmas", label: "Christmas party", icon: "🎄", dishes: ["charcuterie", "meatballs", "caprese", "deviled-eggs", "baked-ziti", "cookie-tray", "cocoa-bar"] },
  { key: "shower", label: "Baby or bridal shower", icon: "🎀", dishes: ["charcuterie", "fruit-platter", "caprese", "pinwheels", "pasta-salad", "cupcakes", "lemonade"] },
  { key: "game-day", label: "Game day", icon: "🏈", dishes: ["wings", "chips-salsa", "sliders", "veggie-tray", "meatballs", "cookie-tray", "water-soda"] },
  { key: "picnic", label: "Picnic or cookout", icon: "🧺", dishes: ["sub-platter", "pasta-salad", "fruit-platter", "chips-salsa", "cookie-tray", "lemonade"] },
  { key: "other", label: "Something else", icon: "🎉", dishes: ["charcuterie", "veggie-tray", "fruit-platter", "meatballs", "cookie-tray", "water-soda"] },
] as const;

export type PartyKind = (typeof PARTY_KINDS)[number]["key"];
export const partyKind = (key: string) => PARTY_KINDS.find((k) => k.key === key) ?? PARTY_KINDS[PARTY_KINDS.length - 1];
export const partyDish = (key: string) => PARTY_DISHES.find((d) => d.key === key);

export type PartyPlan = { kind: string; title: string; date: string; guests: number; meal: boolean; dishes: string[] };

/**
 * How many batches of a dish: guests / servings, with half again as much when the party food is the meal
 * (no dinner after), rounded up to a half recipe (at least one; cakes and trays whole).
 */
export function partyTimes(dish: PartyDish, guests: number, meal: boolean): number {
  const n = (guests / dish.servings) * (meal ? 1.5 : 1);
  return dish.whole ? Math.max(1, Math.ceil(n)) : Math.max(1, Math.ceil(n * 2) / 2);
}

/** The chosen dishes with amounts for the crowd. */
export function partyDishes(p: Pick<PartyPlan, "guests" | "meal" | "dishes">): (PartyDish & { times: number; scaled: Ingredient[] })[] {
  return PARTY_DISHES.filter((d) => p.dishes.includes(d.key)).map((d) => {
    const times = partyTimes(d, p.guests, p.meal);
    const scaled = d.ingredients.map((ing) => {
      const one = times === 1 || !ing.amount.trim() ? ing : scaleIngredient(ing, times);
      return { ...one, unit: agree(one.amount, one.unit) };
    });
    return { ...d, times, scaled };
  });
}

/** When to do what, from two days out to the party. Food safety included: cold food out no more than 2 hours. */
export function partyTimeline(p: Pick<PartyPlan, "date" | "dishes" | "guests" | "meal">): { date: string; what: string }[] {
  const dishes = partyDishes(p);
  const out: { date: string; what: string }[] = [];
  if (dishes.some((d) => d.key === "sheet-cake")) out.push({ date: addDays(p.date, -4), what: "Order the cake from the bakery (name and message)." });
  out.push({ date: addDays(p.date, -2), what: "Shop for the party (the list is ready to add to your groceries)." });
  for (const d of dishes) if (d.ahead) out.push({ date: addDays(p.date, -1), what: `${d.name}: ${d.ahead}` });
  out.push({ date: p.date, what: "Set out boards and cold trays about 30 minutes before guests arrive. Keep cold food out no more than 2 hours, then refrigerate or swap in a fresh tray." });
  if (dishes.some((d) => d.key === "meatballs")) out.push({ date: p.date, what: "Start the meatballs in the slow cooker 4 hours before." });
  return out;
}
