import type { GroceryList, GroceryItem } from "./types";
import { coreWords } from "./pantry";
import { parseAmount } from "./nutrition";
import { niceAmount } from "./scaling";

// Sections whose lines stay as they are: baby food is its own thing, a deal names one product,
// and the pantry sections aren't things to buy.
const KEEP_APART = /^baby$|breakfast meat deal|stock up|pantry check|already in your pantry/i;
// Words that don't change what to buy.
const IGNORE = new Set(["boneles", "skinles", "boneless", "skinless", "raw", "uncooked", "dozen", "ct"]);

/** What a grocery line is, for spotting the same thing in two places: "large eggs" and "Eggs, dozen" are both "egg". */
export function itemKey(name: string): string {
  return coreWords(name.split(/,| - /)[0]).filter((w) => !IGNORE.has(w)).sort().join(" ");
}

/**
 * One line per thing to buy: when the same item shows up in more than one place (weekly staples, a recipe,
 * athlete fuel, snacks), the lines become one, in the first section it appeared, with the amounts added
 * together and a note saying what else it's for.
 */
export function mergeDuplicates(list: GroceryList): GroceryList {
  const first = new Map<string, { section: number; index: number }>();
  const sections = list.sections.map((s) => ({ ...s, items: [...s.items] }));
  const drop = new Set<string>(); // "section:index" of lines folded into an earlier one
  sections.forEach((sec, si) => {
    if (KEEP_APART.test(sec.name)) return;
    sec.items.forEach((it, ii) => {
      const key = itemKey(it.item);
      if (!key) return;
      const seen = first.get(key);
      if (!seen) { first.set(key, { section: si, index: ii }); return; }
      const target = sections[seen.section].items[seen.index];
      sections[seen.section].items[seen.index] = combine(target, it, sections[seen.section].name, sec.name);
      drop.add(`${si}:${ii}`);
    });
  });
  return {
    ...list,
    sections: sections
      .map((sec, si) => ({ ...sec, items: sec.items.filter((_, ii) => !drop.has(`${si}:${ii}`)) }))
      .filter((sec) => sec.items.length),
  };
}

/** Add up amounts with the same unit: "1 gallon + 1/2 cup + 1 gallon" -> "2 gallons + 1/2 cup", "4 + 3 + 2" -> "9". */
export function addQuantities(parts: string[]): string {
  const sums = new Map<string, { n: number; label: string }>();
  const other: string[] = [];
  for (const p of parts.flatMap((q) => q.split(/\s*\+\s*/)).map((q) => q.trim()).filter(Boolean)) {
    const m = p.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/);
    const n = m ? parseAmount(m[1]) : null;
    if (!m || n == null || /\(/.test(m[2])) { other.push(p); continue; } // "1 (15 oz) can" stays as written
    const unit = m[2].toLowerCase();
    const key = unit.replace(/(es|s)$/, ""); // "cups" and "cup" add up
    const e = sums.get(key) ?? { n: 0, label: unit.replace(/(es|s)$/, "") };
    e.n += n;
    sums.set(key, e);
  }
  const added = [...sums.values()].map(({ n, label }) => [niceAmount(n), label && n > 1 && !/^(oz|lb|tsp|tbsp|ct|dozen)$/.test(label) ? `${label}s` : label].filter(Boolean).join(" "));
  return [...added, ...other].join(" + ");
}

function combine(a: GroceryItem, b: GroceryItem, aSection: string, bSection: string): GroceryItem {
  const quantity = addQuantities([a.quantity, b.quantity].filter((q) => q && q.trim()));
  const notes = [...new Set([a.note, b.note].flatMap((n) => (n ? n.split(" · ") : [])).filter(Boolean))];
  // Say where the extra comes from, unless it's from the same section.
  const also = bSection !== aSection ? `also for ${/^everything$/i.test(bSection) ? "recipes" : bSection.toLowerCase()}` : "";
  if (also && !notes.includes(also)) notes.push(also);
  return { ...a, quantity, note: notes.join(" · "), forRecipes: [...new Set([...a.forRecipes, ...b.forRecipes])] };
}
