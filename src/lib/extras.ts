import type { ExtraCategory, ExtraLine, ExtrasRule, SaleItem } from "./types";

export type ExtraLike = {
  id: string;
  category: ExtraCategory;
  name: string;
  mode: "always" | "on-sale" | "rotate" | "when-low";
  qty: number;
  saleQty: number | null;
  anyBrand: boolean;
  servings: number | null;
  status: "have" | "low" | "out";
  lastPickedAt: Date | null;
};

export const CATEGORIES: { key: ExtraCategory; label: string; icon: string }[] = [
  { key: "snacks", label: "Snacks", icon: "🍿" },
  { key: "sweets", label: "Sweets", icon: "🍬" },
  { key: "drinks", label: "Drinks", icon: "🥤" },
  { key: "baby", label: "Baby", icon: "🍼" },
  { key: "pets", label: "Pets", icon: "🐾" },
];

export const MODE_LABEL: Record<ExtraLike["mode"], string> = {
  always: "Every trip",
  "on-sale": "When on sale",
  rotate: "Rotate",
  "when-low": "When low",
};

/** What to search the store for: "Peanut Butter Filled Pretzels (any brand)" -> "peanut butter filled pretzels". */
export function extraSearchTerm(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .split(/,|;| - /)[0]
    .replace(/\b\d+(\.\d+)?\s*(oz|ct|pack|pk|lb|g|ml|l)\b/g, " ")
    .replace(/[^a-z0-9\s'&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A regex of never-buy words, for "any brand" items in a category. */
export function neverRegex(words: string[]): RegExp | null {
  const clean = words.map((w) => w.trim()).filter((w) => w.length >= 2).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return clean.length ? new RegExp(`\\b(${clean.join("|")})`, "i") : null;
}

/** Ideas to start a list with. */
export const EXTRA_IDEAS: Record<ExtraCategory, { name: string; mode: ExtraLike["mode"]; anyBrand?: boolean; servings?: number; qty?: number; saleQty?: number }[]> = {
  snacks: [
    { name: "Goldfish crackers", mode: "on-sale" }, { name: "Cheez-It", mode: "on-sale" }, { name: "Pretzels", mode: "on-sale", anyBrand: true },
    { name: "Granola bars", mode: "on-sale", anyBrand: true }, { name: "Popcorn", mode: "on-sale", anyBrand: true }, { name: "Yogurt cups", mode: "rotate", anyBrand: true },
    { name: "Fresh fruit in season", mode: "on-sale", anyBrand: true, qty: 2 }, { name: "Tortilla chips", mode: "on-sale", anyBrand: true },
  ],
  sweets: [
    { name: "Peanut butter cups", mode: "always" }, { name: "Gummy bears", mode: "on-sale", anyBrand: true }, { name: "Fruit snacks", mode: "rotate", anyBrand: true },
    { name: "Milk chocolate bar", mode: "on-sale", anyBrand: true }, { name: "Chocolate chip cookies", mode: "on-sale", anyBrand: true }, { name: "Sour candy", mode: "on-sale", anyBrand: true },
  ],
  drinks: [
    { name: "Sparkling water", mode: "on-sale", anyBrand: true }, { name: "Iced tea", mode: "rotate" }, { name: "Lemonade", mode: "rotate" },
    { name: "Juice boxes", mode: "on-sale", anyBrand: true }, { name: "Energy drink", mode: "rotate", qty: 2, saleQty: 3 }, { name: "Coffee", mode: "when-low" },
  ],
  baby: [
    { name: "Fruit puree pouches", mode: "rotate", anyBrand: true, servings: 1, qty: 4 }, { name: "Unsweetened applesauce cups", mode: "rotate", anyBrand: true, servings: 6 },
    { name: "Baby yogurt cups", mode: "rotate", anyBrand: true, servings: 6 }, { name: "Grain puffs", mode: "when-low", anyBrand: true },
    { name: "Yogurt melts", mode: "when-low", anyBrand: true }, { name: "Teething wafers", mode: "when-low", anyBrand: true }, { name: "Fruit cups, no sugar added", mode: "rotate", anyBrand: true, servings: 4 },
  ],
  // Pet food is usually one brand the pet is used to, so "when low" by default; treats are happy to wait for a sale.
  pets: [
    { name: "Dry dog food", mode: "when-low" }, { name: "Wet cat food", mode: "when-low" }, { name: "Dog treats", mode: "on-sale", anyBrand: true },
    { name: "Cat treats", mode: "on-sale", anyBrand: true }, { name: "Cat litter", mode: "when-low" }, { name: "Dental chews", mode: "on-sale", anyBrand: true },
  ],
};

/**
 * Which items to price-check this week (the store lookup is limited, so it's capped): every-trip, rotate and
 * running-low items first, then "when on sale" items, least recently bought first so the whole list gets a turn.
 */
export function termsToCheck(items: ExtraLike[], max = 30): string[] {
  const rank = (i: ExtraLike) => (i.mode === "always" ? 0 : i.mode === "rotate" ? 1 : i.mode === "when-low" ? (i.status === "have" ? 9 : 2) : 3);
  const ordered = [...items]
    .filter((i) => !(i.mode === "when-low" && i.status === "have"))
    .sort((a, b) => rank(a) - rank(b) || (a.lastPickedAt?.getTime() ?? 0) - (b.lastPickedAt?.getTime() ?? 0) || Math.random() - 0.5);
  return [...new Set(ordered.map((i) => extraSearchTerm(i.name)))].slice(0, max);
}

/** This week's snacks, sweets, drinks and baby items, following each item's buying rule and each category's rules. */
export function planExtras(
  items: ExtraLike[],
  rules: Record<ExtraCategory, ExtrasRule>,
  sales: SaleItem[],
  prices: Map<string, { price: number; product: string }>,
): ExtraLine[] {
  const saleFor = (i: ExtraLike) => sales.find((s) => s.item === extraSearchTerm(i.name)) ?? null;
  const line = (i: ExtraLike, reason: string): ExtraLine => {
    const sale = saleFor(i);
    const p = prices.get(extraSearchTerm(i.name));
    return { category: i.category, item: i.name, product: sale?.product ?? p?.product ?? null, quantity: sale && i.saleQty ? i.saleQty : i.qty, price: sale?.salePrice ?? p?.price ?? null, sale, reason: sale && reason !== "On sale" ? `${reason} · on sale` : reason };
  };
  const out: ExtraLine[] = [];
  for (const { key } of CATEGORIES) {
    const rule = rules[key];
    const mine = items.filter((i) => i.category === key);
    const picked = new Set<string>();
    const add = (i: ExtraLike, reason: string) => { if (!picked.has(i.id)) { picked.add(i.id); out.push(line(i, reason)); } };
    for (const i of mine) if (i.mode === "always") add(i, "Every trip");
    for (const i of mine) if (i.mode === "when-low" && i.status !== "have") add(i, i.status === "out" ? "You're out" : "Running low");
    for (const i of mine) if (i.mode === "on-sale" && saleFor(i)) add(i, "On sale");
    // Rotate: this category's picks for the week, on-sale ones first, then the one bought longest ago.
    const rotating = mine
      .filter((i) => i.mode === "rotate" && !picked.has(i.id))
      .sort((a, b) => Number(!!saleFor(b)) - Number(!!saleFor(a)) || (a.lastPickedAt?.getTime() ?? 0) - (b.lastPickedAt?.getTime() ?? 0) || Math.random() - 0.5);
    // With a servings target (baby), the target decides how much to buy, not the rotate count.
    if (!rule.servingsTarget) rotating.slice(0, rule.rotateCount).forEach((i) => add(i, "This week's pick"));
    // A weekly servings target (baby snacks counted by servings, not packages): top up from rotate and on-sale items.
    if (rule.servingsTarget) {
      const servingsOf = (l: ExtraLine) => (mine.find((i) => i.name === l.item)?.servings ?? 0) * l.quantity;
      let total = out.filter((l) => l.category === key).reduce((n, l) => n + servingsOf(l), 0);
      const topUps = mine.filter((i) => !picked.has(i.id) && (i.mode === "rotate" || i.mode === "on-sale") && (i.servings ?? 0) > 0)
        .sort((a, b) => Number(!!saleFor(b)) - Number(!!saleFor(a)) || (a.lastPickedAt?.getTime() ?? 0) - (b.lastPickedAt?.getTime() ?? 0));
      for (const i of topUps) {
        if (total >= rule.servingsTarget) break;
        add(i, `Toward ${rule.servingsTarget} servings this week`);
        total += (i.servings ?? 0) * (saleFor(i) && i.saleQty ? i.saleQty : i.qty);
      }
    }
  }
  return out;
}

/** Cost of this week's extras, from the prices found. */
export function extrasTotal(lines: ExtraLine[] | null | undefined): number {
  return (lines ?? []).reduce((n, l) => n + (l.price ?? 0) * l.quantity, 0);
}
