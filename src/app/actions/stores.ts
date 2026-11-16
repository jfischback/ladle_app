"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { activePlans, getSettings } from "@/lib/data";
import { findNearby, krogerEnabled, searchProducts } from "@/lib/kroger";
import { TOO_MANY, under } from "@/lib/rate-limit";
import { ingredientTerm, productMatches } from "@/lib/sales";
import type { Settings } from "@/lib/settings";
import { compareBasket, type Comparison, type NearbyStore, type PriceRow, type SavedStore } from "@/lib/store-compare";
import { today } from "@/lib/week";

const okId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9]{3,16}$/.test(id);

/** Kroger-family stores within a few miles of a zip. */
export async function nearbyStores(zip: string, radius: number): Promise<{ stores?: NearbyStore[]; error?: string; disabled?: boolean }> {
  const userId = await requireUserId();
  if (!krogerEnabled()) return { disabled: true };
  if (!(await under("stores", userId))) return { error: TOO_MANY };
  if (!/^\d{5}$/.test(String(zip).trim())) return { error: "Enter a 5-digit zip code." };
  try {
    return { stores: await findNearby(String(zip).trim(), Number(radius) || 10) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** The other stores to compare with (up to four besides your own). */
export async function saveExtraStores(stores: SavedStore[]): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!Array.isArray(stores)) return { error: "Pick stores from the list." };
  const clean = stores
    .filter((s) => okId(s?.locationId))
    .map((s) => ({ locationId: s.locationId, name: String(s.name ?? "").slice(0, 80), address: String(s.address ?? "").slice(0, 160) }));
  const db = await getDb();
  const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
  if (!row) return { error: "Finish setting up first." };
  const data = row.data as Settings;
  const extra = clean.filter((s, i) => s.locationId !== data.storeLocationId && clean.findIndex((x) => x.locationId === s.locationId) === i);
  if (extra.length > 4) return { error: "Pick up to four other stores." };
  await db.update(settingsTable).set({ data: { ...data, extraStores: extra }, updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
  revalidatePath("/stores");
  return {};
}

/**
 * Price this week's grocery list (up to 15 things) at your store and the others you picked, and say where
 * it's cheapest. Reads prices only; Ladle never shops or checks out anywhere.
 */
export async function compareStores(): Promise<{ result?: Comparison & { stores: SavedStore[]; items: number }; error?: string }> {
  const userId = await requireUserId();
  if (!krogerEnabled()) return { error: "Store prices aren't connected yet." };
  if (!(await under("compare", userId))) return { error: TOO_MANY };
  const { data: settings } = await getSettings(userId);
  if (!settings.storeLocationId) return { error: "Pick your own store in Settings first." };
  if (!settings.extraStores.length) return { error: "Pick at least one other store to compare with." };
  const now = today();
  const withList = (await activePlans(userId)).filter((p) => p.status === "approved" && p.groceryList);
  const plan = withList.find((p) => p.days.some((d) => d.date === now)) ?? withList.find((p) => p.weekOf >= now) ?? withList[0];
  if (!plan?.groceryList) return { error: "Approve a week first, so there's a grocery list to compare." };
  const terms = [...new Set(plan.groceryList.sections.flatMap((s) => s.items.map((i) => ingredientTerm(i.item))).filter((t): t is string => !!t))].slice(0, 15);
  if (!terms.length) return { error: "Nothing on the list to compare yet." };
  const stores: SavedStore[] = [{ locationId: settings.storeLocationId, name: settings.storeName || "Your store", address: "" }, ...settings.extraStores];
  const rows: PriceRow[] = terms.map((item) => ({ item, prices: {} }));
  const jobs = rows.flatMap((row) => stores.map((s) => ({ row, s })));
  const stopAt = Date.now() + 40000;
  for (let i = 0; i < jobs.length && Date.now() < stopAt; i += 6) {
    await Promise.allSettled(
      jobs.slice(i, i + 6).map(async ({ row, s }) => {
        const found = (await searchProducts(row.item, s.locationId, 8)).filter((p) => productMatches(row.item, p));
        if (!found.length) { row.prices[s.locationId] = null; return; }
        const cheapest = found.reduce((a, b) => ((b.promo ?? b.regular) < (a.promo ?? a.regular) ? b : a));
        row.prices[s.locationId] = { price: Math.round((cheapest.promo ?? cheapest.regular) * 100) / 100, onSale: cheapest.promo != null, product: cheapest.description };
      }),
    );
  }
  return { result: { ...compareBasket(rows, stores.map((s) => s.locationId)), stores, items: terms.length } };
}
