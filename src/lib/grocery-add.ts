import type { GroceryList } from "./types";

export const ADDED_SECTION = "Added by you";

/** "2 paper towels" -> { quantity: "2", item: "paper towels" }; "milk" -> { quantity: "1", item: "milk" }. */
export function parseAdded(text: string): { item: string; quantity: string } | null {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 80);
  const m = t.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(?:x\s+)?(.+)$/i);
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
  if (mine.items.length >= 60) return list;
  const same = mine.items.findIndex((i) => i.item.toLowerCase() === parsed.item.toLowerCase());
  if (same >= 0) {
    const was = Number(mine.items[same].quantity);
    const add = Number(parsed.quantity);
    mine.items[same] = { ...mine.items[same], quantity: Number.isFinite(was) && Number.isFinite(add) ? String(was + add) : parsed.quantity };
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
