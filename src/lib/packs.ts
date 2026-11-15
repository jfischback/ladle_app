/** Starter recipe packs: one tap adds every starter with the pack's tag to My Recipes. */
export const PACKS: { tag: string; icon: string; title: string; blurb: string }[] = [
  { tag: "budget", icon: "💵", title: "Budget dinners", blurb: "Filling dinners for about $1 to $2.50 a plate" },
  { tag: "kid-friendly", icon: "🧒", title: "Kid favorites", blurb: "Tenders, pizza night, sloppy joes and more" },
  { tag: "freezer", icon: "🧊", title: "Freezer & make-ahead", blurb: "Cook once, freeze a second dinner" },
  { tag: "vegetarian", icon: "🥦", title: "Vegetarian", blurb: "Meatless dinners, vegan ones marked" },
  { tag: "low-carb", icon: "🥑", title: "Low-carb", blurb: "Under about 20 g carbs a plate" },
  { tag: "low-sodium", icon: "🧂", title: "Lower sodium", blurb: "Easier on blood pressure" },
  { tag: "for-one", icon: "🍽", title: "Cooking for one", blurb: "Single servings, no waste" },
  { tag: "microwave", icon: "📡", title: "Microwave only", blurb: "For dorms and tiny kitchens" },
];
