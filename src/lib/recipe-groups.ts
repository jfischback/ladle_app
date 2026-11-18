/** Recipes grouped by their main protein, in a fixed order, for browsing a long recipe box. */
export const GROUPS = [
  { key: "chicken", label: "Chicken", icon: "🍗" },
  { key: "beef", label: "Beef", icon: "🥩" },
  { key: "pork", label: "Pork & sausage", icon: "🥓" },
  { key: "turkey", label: "Turkey", icon: "🦃" },
  { key: "seafood", label: "Fish & seafood", icon: "🐟" },
  { key: "meatless", label: "Meatless", icon: "🥦" },
  { key: "other", label: "Everything else", icon: "🍽" },
] as const;
export type GroupKey = (typeof GROUPS)[number]["key"];

/** Which group a recipe's main protein falls in. The first meat named wins ("chicken and beef" is chicken). */
export function groupOf(protein: string | null | undefined): GroupKey {
  const p = (protein ?? "").toLowerCase();
  if (/chicken/.test(p)) return "chicken";
  if (/beef|steak|burger/.test(p)) return "beef";
  if (/pork|sausage|ham|bacon/.test(p)) return "pork";
  if (/turkey/.test(p)) return "turkey";
  if (/fish|seafood|salmon|shrimp|tuna|cod|tilapia/.test(p)) return "seafood";
  if (/bean|lentil|tofu|egg|dairy|cheese|chickpea|no meat|vegetarian|vegan/.test(p)) return "meatless";
  return "other";
}

export function groupRecipes<T extends { protein: string | null }>(rows: T[]) {
  return GROUPS.map((g) => ({ ...g, items: rows.filter((r) => groupOf(r.protein) === g.key) })).filter((g) => g.items.length > 0);
}
