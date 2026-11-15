import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Nunito } from "next/font/google";
import { auth, loginRequired } from "@/auth";
import { logout } from "./actions/auth";
import { Wordmark } from "@/components/Logo";
import { NavLinks, TabBar, GearIcon } from "@/components/Nav";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "WONK"] });

export const metadata: Metadata = {
  title: "Ladle",
  description: "Plan the week around what's on sale, then approve the cart.",
};

export const viewport: Viewport = { themeColor: "#F8F4EC", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = loginRequired ? !!(await auth())?.user : true;
  return (
    <html lang="en" className={`${nunito.variable} ${fraunces.variable}`}>
      <body className="min-h-screen">
        {signedIn && (
          <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/90 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
              <Link href="/" aria-label="Ladle home" className="shrink-0">
                <Wordmark className="h-9 w-auto" />
              </Link>
              <NavLinks />
              <div className="flex items-center gap-1 text-sm">
                {loginRequired && (
                  <form action={logout}>
                    <button className="btn-quiet min-h-9 px-3 text-sm">Sign out</button>
                  </form>
                )}
                <Link href="/setup" aria-label="Settings" title="Settings" className="flex h-11 w-11 items-center justify-center rounded-full text-olive-dark hover:bg-olive-soft">
                  <GearIcon />
                </Link>
              </div>
            </div>
          </header>
        )}
        <main className={`mx-auto max-w-3xl px-4 pt-5 sm:pt-8 ${signedIn ? "pb-32 sm:pb-12" : "pb-12"}`}>{children}</main>
        {signedIn && <TabBar />}
      </body>
    </html>
  );
}
