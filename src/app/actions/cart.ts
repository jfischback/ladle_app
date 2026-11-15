"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { krogerAccounts, plans } from "@/db/schema";
import { getPlan, getSettings } from "@/lib/data";
import { addToCart, krogerEnabled, refreshUserTokens, searchProducts } from "@/lib/kroger";
import { cartItems, packagesForWeight, pickOptions } from "@/lib/cart";
import { open, seal } from "@/lib/secret-box";
import type { CartLine, CartState } from "@/lib/types";
import { storeBrand, yourStore } from "@/lib/stores";
import { TOO_MANY, under } from "@/lib/rate-limit";

async function saveCart(userId: string, planId: string, cart: CartState) {
  const db = await getDb();
  await db.update(plans).set({ cart }).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/cart");
}

/** Find a store product for each item on this week's approved grocery list. */
export async function matchCart(planId: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!(await under("cartMatch", userId))) return { error: TOO_MANY };
  const [plan, { data: settings }] = await Promise.all([getPlan(userId, planId), getSettings(userId)]);
  if (!plan?.groceryList || plan.status !== "approved") return { error: "Approve this week's plan first, so there's a grocery list." };
  const brand = storeBrand(settings.storeName);
  if (!krogerEnabled()) return { error: "Store prices aren't connected to Ladle yet." };
  if (!settings.storeLocationId) return { error: "Pick your store in Settings first." };
  const store = settings.storeLocationId;

  const items = cartItems(plan.groceryList);
  // Keep earlier choices (quantity, product, skipped) for items still on the list.
  const before = new Map((plan.cart?.lines ?? []).map((l) => [l.key, l]));
  const saleProduct = new Map((plan.saleItems ?? []).flatMap((s) => (typeof s === "string" ? [] : [[s.item, s.product] as const])));

  const lines: CartLine[] = [];
  const stopAt = Date.now() + 40000;
  for (let i = 0; i < items.length; i += 6) {
    const batch = items.slice(i, i + 6);
    const found = Date.now() < stopAt
      ? await Promise.allSettled(batch.map((x) => searchProducts(x.term, store, 10)))
      : batch.map(() => ({ status: "rejected" as const, reason: "out of time" }));
    batch.forEach((x, j) => {
      const r = found[j];
      const prev = before.get(x.key);
      const { options, chosen } = r.status === "fulfilled" ? pickOptions(x.term, r.value, saleProduct.get(x.term), settings.tightBudget, settings.foodRules) : { options: [], chosen: null };
      const keepChoice = prev && prev.chosen != null ? options.findIndex((o) => o.upc === prev.options[prev.chosen!]?.upc) : -1;
      const pick = keepChoice >= 0 ? keepChoice : chosen;
      // Weighed items: as many packages of the chosen product as the recipe amounts need.
      const byWeight = pick != null && options[pick] ? packagesForWeight(x.raw, options[pick].size) : null;
      lines.push({ key: x.key, section: x.section, item: x.item, quantity: prev ? prev.quantity : byWeight ?? x.quantity, chosen: pick, options });
    });
  }
  if (lines.length && lines.every((l) => !l.options.length)) return { error: `${brand.name ?? "The store"} didn't answer. Try again in a minute.` };
  await saveCart(userId, planId, { matchedAt: new Date().toISOString(), lines, sentAt: plan.cart?.sentAt ?? null, sentCount: plan.cart?.sentCount });
  return {};
}

/** Change one line: how many, which product, or skip it (quantity 0). */
export async function updateCartLine(planId: string, key: string, patch: { quantity?: number; chosen?: number | null }) {
  const userId = await requireUserId();
  const plan = await getPlan(userId, planId);
  if (!plan?.cart) return;
  const lines = plan.cart.lines.map((l) => {
    if (l.key !== key) return l;
    const quantity = patch.quantity != null && Number.isFinite(patch.quantity) ? Math.min(Math.max(Math.round(patch.quantity), 0), 24) : l.quantity;
    const chosen = patch.chosen === undefined ? l.chosen : patch.chosen === null ? null : patch.chosen >= 0 && patch.chosen < l.options.length ? patch.chosen : l.chosen;
    return { ...l, quantity, chosen };
  });
  await saveCart(userId, planId, { ...plan.cart, lines });
}

/** A fresh access token for this family's store account (renewed when it's about to run out). */
async function userAccessToken(userId: string): Promise<string | null> {
  const db = await getDb();
  const [acct] = await db.select().from(krogerAccounts).where(eq(krogerAccounts.userId, userId));
  if (!acct) return null;
  if (acct.expiresAt.getTime() - Date.now() > 120000) return open(acct.accessToken);
  try {
    const t = await refreshUserTokens(open(acct.refreshToken));
    await db
      .update(krogerAccounts)
      .set({ accessToken: seal(t.accessToken), refreshToken: seal(t.refreshToken || open(acct.refreshToken)), expiresAt: t.expiresAt })
      .where(eq(krogerAccounts.userId, userId));
    return t.accessToken;
  } catch {
    // The sign-in ran out for good (Kroger refresh tokens last months): ask them to connect again.
    await db.delete(krogerAccounts).where(eq(krogerAccounts.userId, userId));
    return null;
  }
}

/** Put the chosen products in the family's store cart. It never checks out: they finish on the store's site. */
export async function sendCart(planId: string): Promise<{ error?: string; reconnect?: boolean; sent?: number }> {
  const userId = await requireUserId();
  if (!(await under("cartSend", userId))) return { error: TOO_MANY };
  const [plan, { data: settings }] = await Promise.all([getPlan(userId, planId), getSettings(userId)]);
  if (!plan?.cart) return { error: "Find products first." };
  const items = plan.cart.lines
    .filter((l) => l.quantity > 0 && l.chosen != null && l.options[l.chosen])
    .map((l) => ({ upc: l.options[l.chosen!].upc, quantity: l.quantity }));
  if (!items.length) return { error: "Nothing picked to send." };
  const token = await userAccessToken(userId);
  if (!token) return { reconnect: true, error: `Connect ${yourStore(storeBrand(settings.storeName))} account first.` };
  try {
    await addToCart(token, items, settings.fulfillment === "delivery" ? "DELIVERY" : "PICKUP");
  } catch (e) {
    if ((e as Error).message === "NEEDS_RECONNECT") {
      const db = await getDb();
      await db.delete(krogerAccounts).where(eq(krogerAccounts.userId, userId));
      return { reconnect: true, error: "The store asked you to sign in again." };
    }
    return { error: (e as Error).message };
  }
  await saveCart(userId, planId, { ...plan.cart, sentAt: new Date().toISOString(), sentCount: items.length });
  return { sent: items.length };
}

export async function disconnectKroger() {
  const userId = await requireUserId();
  const db = await getDb();
  await db.delete(krogerAccounts).where(eq(krogerAccounts.userId, userId));
  revalidatePath("/cart");
}
