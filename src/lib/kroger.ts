import "server-only";

/**
 * Kroger Public API (developer.kroger.com). Fry's is a Kroger banner.
 * Stage 1 uses Locations only. Product prices come after the sale-price test (spec section 14);
 * cart fill comes after that, behind Approve. The app never checks out.
 */
// KROGER_API_BASE is only for testing against a stand-in server.
const BASE = process.env.KROGER_API_BASE ?? "https://api.kroger.com/v1";

export function krogerEnabled(): boolean {
  return !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);
}

const cached = new Map<string, { token: string; expires: number }>();

async function appToken(scope?: string): Promise<string> {
  const hit = cached.get(scope ?? "");
  if (hit && hit.expires > Date.now() + 60_000) return hit.token;
  const basic = Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) body.set("scope", scope);
  const res = await fetch(`${BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Kroger sign-in failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached.set(scope ?? "", { token: json.access_token, expires: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

export type StoreLocation = { locationId: string; name: string; address: string };

export async function findFrysStores(zip: string): Promise<StoreLocation[]> {
  const token = await appToken();
  const url = new URL(`${BASE}/locations`);
  url.searchParams.set("filter.zipCode.near", zip);
  url.searchParams.set("filter.chain", "FRYS");
  url.searchParams.set("filter.limit", "10");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Store lookup failed (${res.status})`);
  const json = (await res.json()) as {
    data: { locationId: string; name: string; address: { addressLine1: string; city: string; state: string; zipCode: string } }[];
  };
  return json.data.map((l) => ({
    locationId: l.locationId,
    name: l.name,
    address: `${l.address.addressLine1}, ${l.address.city}, ${l.address.state} ${l.address.zipCode}`,
  }));
}

export type KrogerProduct = {
  productId: string;
  description: string;
  brand: string;
  size: string;
  regular: number;
  /** Sale price, or null when the product isn't on promotion. */
  promo: number | null;
};

/** Search products at one store, with that store's prices. Needs the product.compact scope. */
export async function searchProducts(term: string, locationId: string, limit = 12): Promise<KrogerProduct[]> {
  const token = await appToken("product.compact");
  const url = new URL(`${BASE}/products`);
  url.searchParams.set("filter.term", term);
  url.searchParams.set("filter.locationId", locationId);
  url.searchParams.set("filter.limit", String(limit));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Price lookup failed (${res.status})`);
  const json = (await res.json()) as {
    data?: {
      productId: string;
      description?: string;
      brand?: string;
      items?: { size?: string; price?: { regular?: number; promo?: number } }[];
    }[];
  };
  const out: KrogerProduct[] = [];
  for (const p of json.data ?? []) {
    const item = p.items?.[0];
    const regular = item?.price?.regular;
    if (!regular) continue; // not sold at this store, or no price shown
    const promo = item?.price?.promo;
    out.push({
      productId: p.productId,
      description: p.description ?? "",
      brand: p.brand ?? "",
      size: item?.size ?? "",
      regular,
      promo: promo && promo > 0 && promo < regular ? promo : null,
    });
  }
  return out;
}
