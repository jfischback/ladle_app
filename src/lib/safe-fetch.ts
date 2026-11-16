import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch a web page someone typed in (a recipe link, a cook's site) without letting it reach private
 * addresses: localhost, the home or office network, or a cloud provider's metadata service.
 * Every redirect is checked again, and the download is capped.
 */

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

/** The eight 16-bit groups of an IPv6 address (with "::" filled in and a dotted tail converted), or null. */
function v6Groups(ip: string): number[] | null {
  let x = ip.toLowerCase().split("%")[0];
  // A dotted IPv4 tail ("::ffff:127.0.0.1") is two groups.
  const tail = x.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    x = x.slice(0, tail.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const halves = x.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...rest].map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return groups.length === 8 && groups.every((n) => !Number.isNaN(n)) ? groups : null;
}

function privateV6(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return true; // can't read it: don't fetch it
  const v4 = (hi: number, lo: number) => privateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(8)) return true; // ::
  if (zeros(7) && g[7] === 1) return true; // ::1
  // An IPv4 address wearing an IPv6 coat, however it's written ("::ffff:127.0.0.1" is the same as "::ffff:7f00:1"):
  if (zeros(5) && g[5] === 0xffff) return v4(g[6], g[7]); // IPv4-mapped
  if (zeros(6)) return v4(g[6], g[7]); // IPv4-compatible (old)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4(g[6], g[7]); // NAT64
  if (g[0] === 0x2002) return v4(g[1], g[2]); // 6to4
  const top = g[0];
  return (top & 0xfe00) === 0xfc00 || (top & 0xffc0) === 0xfe80 || (top & 0xffc0) === 0xfec0 || (top & 0xff00) === 0xff00; // unique local, link-local, site-local, multicast
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  return kind === 4 ? privateV4(ip) : kind === 6 ? privateV6(ip) : true;
}

/** Throws if the URL isn't a normal public web address. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("That doesn't look like a web link.");
  if (u.username || u.password) throw new Error("That link isn't supported.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("That link isn't supported.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That link isn't a public web page.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) throw new Error("We couldn't find that website.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That link isn't a public web page.");
  return u;
}

/** Like fetch, for user-supplied links: public addresses only, redirects re-checked, body capped at `maxBytes`. */
export async function safeFetchText(raw: string | URL, init: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number } = {}): Promise<{ status: number; ok: boolean; url: string; text: string }> {
  const maxBytes = init.maxBytes ?? 3_000_000;
  const signal = AbortSignal.timeout(init.timeoutMs ?? 15000);
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(url, { headers: init.headers, signal, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url));
      continue;
    }
    // Read at most maxBytes, so a huge page can't tie up the server.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader && size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader?.cancel().catch(() => {});
    const text = new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
    return { status: res.status, ok: res.ok, url: url.toString(), text };
  }
  throw new Error("That link redirects too many times.");
}
