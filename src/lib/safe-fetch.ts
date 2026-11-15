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

function privateV6(ip: string): boolean {
  const x = ip.toLowerCase();
  if (x === "::" || x === "::1") return true;
  const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x); // unique local, link-local, multicast
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
