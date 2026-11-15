import "server-only";

/**
 * Kroger Public API (developer.kroger.com). Fry's is a Kroger banner.
 * Stage 1 uses Locations only. Product prices come after the sale-price test (spec section 14);
 * cart fill comes after that, behind Approve. The app never checks out.
 */
// KROGER_API_BASE points at a stand-in server for local testing only; it's ignored in production so Kroger
// credentials and family tokens can never be sent anywhere else.
const BASE = (process.env.NODE_ENV !== "production" && process.env.KROGER_API_BASE) || "https://api.kroger.com/v1";

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

export type StoreLocation = { locationId: string; name: string; address: string; chain: string };

/** Kroger-family grocery stores near a zip: Kroger, Fry's, Ralphs, King Soopers and the rest. */
export async function findStores(zip: string): Promise<StoreLocation[]> {
  const token = await appToken();
  const url = new URL(`${BASE}/locations`);
  url.searchParams.set("filter.zipCode.near", zip);
  url.searchParams.set("filter.limit", "10");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Store lookup failed (${res.status})`);
  const json = (await res.json()) as {
    data: { locationId: string; name: string; chain?: string; address: { addressLine1: string; city: string; state: string; zipCode: string } }[];
  };
  return json.data.map((l) => ({
    locationId: l.locationId,
    name: l.name,
    chain: l.chain ?? "",
    address: `${l.address.addressLine1}, ${l.address.city}, ${l.address.state} ${l.address.zipCode}`,
  }));
}

export type KrogerProduct = {
  productId: string;
  upc: string; // what the cart API takes
  description: string;
  brand: string;
  size: string;
  regular: number;
  /** Sale price, or null when the product isn't on promotion. */
  promo: number | null;
  /** Where it is in this store ("Aisle 12"), when Kroger says. */
  aisle?: string | null;
};

type AisleLocation = { number?: string; description?: string };

/** "Aisle 12" from Kroger's aisle locations; null when there's nothing useful. */
export function aisleLabel(locations: AisleLocation[] | undefined): string | null {
  const a = locations?.find((l) => l.number || l.description);
  if (!a) return null;
  if (a.number && /^\d{1,3}$/.test(a.number.trim()) && Number(a.number) > 0) return `Aisle ${Number(a.number)}`;
  const d = (a.description ?? "").trim();
  if (!d || d.length > 30) return null;
  return d.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

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
      upc?: string;
      description?: string;
      brand?: string;
      items?: { size?: string; price?: { regular?: number; promo?: number } }[];
      aisleLocations?: AisleLocation[];
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
      upc: p.upc ?? p.productId,
      description: p.description ?? "",
      brand: p.brand ?? "",
      size: item?.size ?? "",
      regular,
      promo: promo && promo > 0 && promo < regular ? promo : null,
      aisle: aisleLabel(p.aisleLocations),
    });
  }
  return out;
}

// ---------- a family's own Kroger account (for filling their cart) ----------

export const CART_SCOPE = "cart.basic:write profile.compact";

/** Where to send someone to connect their Fry's account. */
export function authorizeUrl(redirectUri: string, state: string): string {
  const u = new URL(`${BASE}/connect/oauth2/authorize`);
  u.searchParams.set("scope", CART_SCOPE);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.KROGER_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

export type UserTokens = { accessToken: string; refreshToken: string; expiresAt: Date };

async function tokenRequest(body: URLSearchParams): Promise<UserTokens> {
  const basic = Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Fry's sign-in failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { accessToken: j.access_token, refreshToken: j.refresh_token ?? "", expiresAt: new Date(Date.now() + j.expires_in * 1000) };
}

export const exchangeCode = (code: string, redirectUri: string) =>
  tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));

export const refreshUserTokens = (refreshToken: string) =>
  tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));

/**
 * Add items to the family's Fry's cart (pickup or delivery). This only fills the cart: the family reviews,
 * pays and checks out on Fry's themselves. The app never checks out.
 */
export async function addToCart(accessToken: string, items: { upc: string; quantity: number }[], modality: "PICKUP" | "DELIVERY") {
  for (let i = 0; i < items.length; i += 25) {
    const res = await fetch(`${BASE}/cart/add`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: items.slice(i, i + 25).map((x) => ({ upc: x.upc, quantity: x.quantity, modality })) }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 401) throw new Error("NEEDS_RECONNECT");
    if (!res.ok) throw new Error(`Fry's didn't accept the cart (${res.status})`);
  }
}
