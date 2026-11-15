import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth, loginRequired } from "@/auth";
import { logout } from "./actions/auth";
import { Wordmark } from "@/components/Logo";
import { NavLinks } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ladle",
  description: "Plan the week around what's on sale, then approve the cart.",
};

export const viewport: Viewport = { themeColor: "#5E6B47", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = loginRequired ? !!(await auth())?.user : true;
  return (
    <html lang="en">
      <body className="min-h-screen">
        {signedIn && (
          <header className="border-b border-line bg-oat">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href="/" aria-label="Ladle home">
                <Wordmark className="h-9 w-auto" />
              </Link>
              <NavLinks />
              <div className="flex items-center gap-1 text-sm">
                <Link href="/setup" className="btn-quiet min-h-9 px-3 text-sm">
                  Settings
                </Link>
                {loginRequired && (
                  <form action={logout}>
                    <button className="btn-quiet min-h-9 px-3 text-sm">Sign out</button>
                  </form>
                )}
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
