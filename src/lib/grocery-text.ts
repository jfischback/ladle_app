import type { GroceryList } from "./types";

const SKIP = /already in your pantry/i;

/**
 * The grocery list as plain text, for texting it to someone or pasting it in a notes app.
 * Items already checked off are left out, so "send what's left" works mid-shop.
 */
export function groceryText(list: GroceryList, opts: { title?: string; isChecked?: (sectionName: string, index: number, item: string) => boolean } = {}): string {
  const out: string[] = [opts.title ?? "Grocery list"];
  for (const sec of list.sections) {
    if (SKIP.test(sec.name)) continue;
    const items = sec.items
      .map((it, i) => ({ it, i }))
      .filter(({ it, i }) => !opts.isChecked?.(sec.name, i, it.item))
      .map(({ it }) => `• ${it.item}${it.quantity ? ` (${it.quantity})` : ""}`);
    if (!items.length) continue;
    out.push("", /pantry check/i.test(sec.name) ? "If you're out of these:" : sec.name, ...items);
  }
  return out.length > 1 ? out.join("\n") : `${out[0]}\n\nAll done! 🎉`;
}
