import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";

// Login is off unless REQUIRE_LOGIN=true. While it's off, everyone uses one built-in account.
const loginRequired = process.env.REQUIRE_LOGIN === "true";

const withAuth = loginRequired ? NextAuth(authConfig).auth : null;

export default function middleware(req: NextRequest, ctx: unknown) {
  if (withAuth) return (withAuth as unknown as (r: NextRequest, c: unknown) => Response)(req, ctx);
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // App files that must load without signing in: the install manifest, icons and the service worker.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|icons/).*)"],
};
