import "server-only";

/**
 * Kroger Public API (developer.kroger.com). Fry's is a Kroger banner.
 * Stage 1 uses Locations only. Product prices come after the sale-price test (spec section 14);
 * cart fill comes after that, behind Approve. The app never checks out.
 */
const BASE = "https://api.kroger.com/v1";

export function krogerEnabled(): boolean {
  return !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);
}

let cached: { token: string; expires: number } | null = null;

async function appToken(scope?: string): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000 && !scope) return cached.token;
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
  if (!scope) cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
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
