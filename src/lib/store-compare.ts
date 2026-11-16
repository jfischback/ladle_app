/** Nearby Kroger-family stores: distances, a little map, and comparing this week's list across them. */

export type NearbyStore = { locationId: string; name: string; address: string; chain: string; lat: number | null; lng: number | null };
export type SavedStore = { locationId: string; name: string; address: string };

/** Miles between two points (great-circle). */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/**
 * Where each store sits on a square map centered on `center`, `radius` miles to the edge: x and y from 0 to 1
 * (north up). Stores past the edge are pinned to it.
 */
export function mapPoints(center: { lat: number; lng: number }, stores: NearbyStore[], radius: number): { id: string; x: number; y: number; miles: number }[] {
  return stores
    .filter((s): s is NearbyStore & { lat: number; lng: number } => s.lat != null && s.lng != null)
    .map((s) => {
      const dy = (s.lat - center.lat) * 69; // miles per degree of latitude
      const dx = (s.lng - center.lng) * 69 * Math.cos((center.lat * Math.PI) / 180);
      const clamp = (v: number) => Math.max(0.03, Math.min(0.97, v));
      return { id: s.locationId, x: clamp(0.5 + dx / (2 * radius)), y: clamp(0.5 - dy / (2 * radius)), miles: milesBetween(center, s) };
    });
}

/** One item's price at each store (null: not found there). */
/** `per` is the price per ounce (or per item) when the package size could be read, so different sizes compare fairly. */
export type PriceRow = { item: string; prices: Record<string, { price: number; onSale: boolean; product: string; per?: number; unit?: "oz" | "ct" } | null> };

/**
 * What the same amount costs at each store. When every store's package size is known (and in the same kind of
 * unit), each is priced for the smallest package among them: a $3 five-pound bag beats a $2 one-pound bag.
 * Otherwise the package prices are all there is to go on.
 */
export function sameAmountCosts(row: PriceRow, storeIds: string[]): Record<string, number> {
  const have = storeIds.filter((id) => row.prices[id]);
  const sized = have.every((id) => row.prices[id]!.per && row.prices[id]!.unit === row.prices[have[0]]!.unit);
  if (!sized) return Object.fromEntries(have.map((id) => [id, row.prices[id]!.price]));
  const amount = Math.min(...have.map((id) => row.prices[id]!.price / row.prices[id]!.per!));
  return Object.fromEntries(have.map((id) => [id, Math.round(row.prices[id]!.per! * amount * 100) / 100]));
}

export type Comparison = {
  rows: (PriceRow & { best: string | null })[];
  /** Per store: the total for the items every store had (a fair comparison), and how many sale items. */
  totals: { locationId: string; total: number; sales: number; found: number }[];
  /** How many items every store had. */
  shared: number;
  cheapest: string | null;
};

/** Which store is cheapest for each item and overall, comparing only items every store carries. */
export function compareBasket(rows: PriceRow[], storeIds: string[]): Comparison {
  const costs = new Map(rows.map((r) => [r, sameAmountCosts(r, storeIds)]));
  const withBest = rows.map((r) => {
    const c = costs.get(r)!;
    let best: string | null = null;
    for (const id of storeIds) if (c[id] != null && (best === null || c[id] < c[best])) best = id;
    return { ...r, best };
  });
  const everywhere = rows.filter((r) => storeIds.every((id) => r.prices[id]));
  const totals = storeIds.map((id) => ({
    locationId: id,
    total: Math.round(everywhere.reduce((a, r) => a + costs.get(r)![id], 0) * 100) / 100,
    sales: rows.filter((r) => r.prices[id]?.onSale).length,
    found: rows.filter((r) => r.prices[id]).length,
  }));
  const cheapest = everywhere.length ? [...totals].sort((a, b) => a.total - b.total)[0].locationId : null;
  return { rows: withBest, totals, shared: everywhere.length, cheapest };
}
