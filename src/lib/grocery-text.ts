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

/**
 * The list written for an AI shopping assistant the family runs on their own account (Claude in their browser,
 * ChatGPT, …): clear instructions plus every item with its amount, so it can fill a cart at any store.
 * Ladle never shops other stores itself; this is just text they paste.
 */
export function assistantText(list: GroceryList, opts: { store?: string; budget?: number | null; rules?: string; isChecked?: (sectionName: string, index: number, item: string) => boolean } = {}): string {
  const items = groceryText(list, { title: "Items", isChecked: opts.isChecked }).split("\n").slice(2);
  const asks = [
    `Please add these groceries to my cart${opts.store ? ` at ${opts.store}` : ""}. Don't check out: I'll review the cart and pay myself.`,
    "For each item, pick the best-value product that matches (store brand is fine), in a size that covers the amount listed. If something is on sale, prefer it.",
    "If an item isn't available, pick the closest substitute and tell me what you swapped.",
    ...(opts.rules ? [`Our food rules (never break these): ${opts.rules}.`] : []),
    ...(opts.budget ? [`Try to keep the cart under $${Math.round(opts.budget)}.`] : []),
    "When you're done, give me a short list of anything you couldn't find.",
  ];
  return [...asks, "", "Items:", ...items].join("\n");
}
