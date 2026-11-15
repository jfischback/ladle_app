import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { krogerAccounts } from "@/db/schema";
import { exchangeCode } from "@/lib/kroger";
import { seal } from "@/lib/secret-box";
import { redirectUri } from "../redirect";

/** Fry's sends the family back here after they sign in. Save their (encrypted) sign-in and go back to the cart. */
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const q = req.nextUrl.searchParams;
  const plan = req.cookies.get("kroger_plan")?.value;
  const back = (extra: string) => {
    const res = NextResponse.redirect(new URL(`/cart?${plan ? `plan=${plan}&` : ""}${extra}`, req.url));
    res.cookies.delete({ name: "kroger_state", path: "/api/kroger" });
    res.cookies.delete({ name: "kroger_plan", path: "/api/kroger" });
    return res;
  };
  const expected = req.cookies.get("kroger_state")?.value;
  if (q.get("error")) return back("error=declined");
  const code = q.get("code");
  if (!code || !expected || q.get("state") !== expected) return back("error=expired");
  try {
    const t = await exchangeCode(code, redirectUri(req));
    if (!t.refreshToken) return back("error=failed");
    const row = { accessToken: seal(t.accessToken), refreshToken: seal(t.refreshToken), expiresAt: t.expiresAt, connectedAt: new Date() };
    const db = await getDb();
    await db.insert(krogerAccounts).values({ userId, ...row }).onConflictDoUpdate({ target: krogerAccounts.userId, set: row });
  } catch {
    return back("error=failed");
  }
  return back("connected=1");
}
