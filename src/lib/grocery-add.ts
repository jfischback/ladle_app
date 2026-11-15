import type { GroceryList } from "./types";
import { niceAmount } from "./scaling";
import { parseAmount } from "./nutrition";

export const ADDED_SECTION = "Added by you";

/** "2 paper towels" -> { quantity: "2", item: "paper towels" }; "milk" -> { quantity: "1", item: "milk" }. */
export function parseAdded(text: string): { item: string; quantity: string } | null {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 80);
  // The amount must be a whole word ("1/2 gallon milk", "3 x candles"), so "7up" and "9v batteries" stay names.
  const m = t.match(/^(\d+\/\d+|\d+(?:\.\d+)?)\s+(?:x\s+)?(.+)$/i);
  const item = (m ? m[2] : t).trim();
  if (item.length < 2) return null;
  return { item, quantity: m ? m[1] : "1" };
}

/** Add things the family typed in to the week's list (in their own section); repeats add up. */
export function addToList(list: GroceryList, text: string): GroceryList {
  const parsed = parseAdded(text);
  if (!parsed) return list;
  const sections = list.sections.map((s) => ({ ...s, items: [...s.items] }));
  let mine = sections.find((s) => s.name === ADDED_SECTION);
  if (!mine) {
    mine = { name: ADDED_SECTION, items: [] };
    sections.unshift(mine);
  }
  if (mine.items.length >= 60) throw new Error("That's a lot of added items: take a few off first.");
  const same = mine.items.findIndex((i) => i.item.toLowerCase() === parsed.item.toLowerCase());
  if (same >= 0) {
    const was = parseAmount(mine.items[same].quantity);
    const add = parseAmount(parsed.quantity);
    mine.items[same] = { ...mine.items[same], quantity: was != null && add != null ? niceAmount(was + add) : `${mine.items[same].quantity} + ${parsed.quantity}` };
  } else {
    mine.items.push({ item: parsed.item, quantity: parsed.quantity, forRecipes: [], added: true });
  }
  return { ...list, sections };
}

/** Take something the family added back off the list. */
export function removeFromList(list: GroceryList, item: string): GroceryList {
  const sections = list.sections
    .map((s) => (s.name === ADDED_SECTION ? { ...s, items: s.items.filter((i) => i.item !== item) } : s))
    .filter((s) => s.items.length);
  return { ...list, sections };
}
