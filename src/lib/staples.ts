import type { Staple, StapleLine } from "./types";

/** One-tap ideas on the staples page. */
export const STAPLE_IDEAS: Staple[] = [
  { item: "Milk", quantity: "1 gallon", active: true },
  { item: "Eggs", quantity: "1 dozen", active: true },
  { item: "Bread", quantity: "1 loaf", active: true },
  { item: "Butter", quantity: "1 lb", active: true },
  { item: "Bananas", quantity: "1 bunch", active: true },
  { item: "Apples", quantity: "3 lb bag", active: true },
  { item: "Strawberries", quantity: "1 lb", active: true },
  { item: "Yogurt", quantity: "32 oz", active: true },
  { item: "Shredded cheese", quantity: "2 bags", active: true },
  { item: "Lunch meat", quantity: "1 lb", active: true },
  { item: "Coffee", quantity: "1 bag", active: true },
  { item: "Cereal", quantity: "2 boxes", active: true },
  { item: "Tortillas", quantity: "1 pack", active: true },
  { item: "Baby carrots", quantity: "1 lb bag", active: true },
  { item: "Goldfish crackers", quantity: "1 box", active: true },
  { item: "Sparkling water", quantity: "12 pack", active: true },
];

/** What this week's staples add to the cart, from the prices we found (staples without a price count as 0). */
export function staplesTotal(lines: StapleLine[] | null | undefined): { total: number; priced: number; count: number } {
  const list = lines ?? [];
  const priced = list.filter((l) => l.price != null);
  return { total: priced.reduce((a, l) => a + (l.price ?? 0), 0), priced: priced.length, count: list.length };
}

/** The search word for a staple: "Shredded cheese" -> "shredded cheese". */
export const stapleTerm = (item: string) => item.toLowerCase().replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim();
