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
export type PriceRow = { item: string; prices: Record<string, { price: number; onSale: boolean; product: string } | null> };

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
  const withBest = rows.map((r) => {
    let best: string | null = null;
    for (const id of storeIds) {
      const p = r.prices[id];
      if (p && (best === null || p.price < r.prices[best]!.price)) best = id;
    }
    return { ...r, best };
  });
  const everywhere = rows.filter((r) => storeIds.every((id) => r.prices[id]));
  const totals = storeIds.map((id) => ({
    locationId: id,
    total: Math.round(everywhere.reduce((a, r) => a + r.prices[id]!.price, 0) * 100) / 100,
    sales: rows.filter((r) => r.prices[id]?.onSale).length,
    found: rows.filter((r) => r.prices[id]).length,
  }));
  const cheapest = everywhere.length ? [...totals].sort((a, b) => a.total - b.total)[0].locationId : null;
  return { rows: withBest, totals, shared: everywhere.length, cheapest };
}
