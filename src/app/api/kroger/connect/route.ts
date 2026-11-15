import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/auth";
import { authorizeUrl, krogerEnabled } from "@/lib/kroger";
import { redirectUri } from "../redirect";

/** Send the family to Fry's (Kroger) to sign in and let Ladle fill their cart. */
export async function GET(req: NextRequest) {
  await requireUserId();
  if (!krogerEnabled()) return NextResponse.redirect(new URL("/cart?error=not-set-up", req.url));
  const state = randomBytes(18).toString("base64url");
  const plan = req.nextUrl.searchParams.get("plan") ?? "";
  const res = NextResponse.redirect(authorizeUrl(redirectUri(req), state));
  const cookie = { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax" as const, path: "/api/kroger", maxAge: 600 };
  res.cookies.set("kroger_state", state, cookie);
  if (/^[0-9a-f-]{36}$/i.test(plan)) res.cookies.set("kroger_plan", plan, cookie);
  return res;
}
