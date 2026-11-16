import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by middleware and the full auth setup.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = pathname === "/welcome" || pathname.startsWith("/api/cron/") || pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot") || pathname.startsWith("/reset/");
      if (isPublic) return true;
      // Someone new opening Ladle sees what it does first, not a bare sign-in form.
      if (!auth?.user && pathname === "/") return Response.redirect(new URL("/welcome", request.nextUrl));
      return !!auth?.user;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
