import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets (a family's Kroger tokens) before they go in the database.
 * The key comes from LADLE_TOKEN_KEY if set, otherwise from the Kroger client secret, so a database copy alone
 * can't be used to reach anyone's Fry's account.
 */
function key(): Buffer {
  const material = process.env.LADLE_TOKEN_KEY || process.env.KROGER_CLIENT_SECRET;
  if (!material) throw new Error("No key to protect Kroger tokens (set KROGER_CLIENT_SECRET).");
  return createHash("sha256").update(`ladle-kroger-tokens:${material}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1") throw new Error("Unknown token format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
