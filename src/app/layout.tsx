import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Nunito } from "next/font/google";
import { auth, loginRequired } from "@/auth";
import { logout } from "./actions/auth";
import { Wordmark } from "@/components/Logo";
import { NavLinks, TabBar, GearIcon } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "WONK"] });

export const metadata: Metadata = {
  title: "Ladle",
  description: "Plan the week around what's on sale, then approve the cart.",
  // Added to an iPhone home screen, Ladle opens full screen like an app.
  appleWebApp: { capable: true, title: "Ladle", statusBarStyle: "default" },
};

// Every page shows today's plan and live data, so build it fresh on each visit (never frozen at build time).
export const dynamic = "force-dynamic";

// On Vercel the built-in local database can't save anything, so a real Postgres database must be connected.
const databaseMissing = !!process.env.VERCEL && !process.env.DATABASE_URL && !process.env.POSTGRES_URL;

export const viewport: Viewport = { themeColor: "#F8F4EC", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (databaseMissing) return <SetupNeeded />;
  const signedIn = loginRequired ? !!(await auth())?.user : true;
  return (
    <html lang="en" className={`${nunito.variable} ${fraunces.variable}`}>
      <body className="min-h-screen">
        {signedIn && (
          <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-cream/90 backdrop-blur">
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
                <Link href="/setup" title="Settings" className="hidden h-11 items-center justify-center gap-1.5 rounded-full px-3 font-bold text-olive-dark hover:bg-olive-soft sm:flex">
                  <GearIcon />
                  <span>Settings</span>
                </Link>
              </div>
            </div>
          </header>
        )}
        <main className={`mx-auto max-w-3xl px-4 pt-5 sm:pt-8 ${signedIn ? "pb-32 sm:pb-12" : "pb-12"}`}>{children}</main>
        {signedIn && <TabBar />}
        <ServiceWorker clear={!signedIn} />
      </body>
    </html>
  );
}

function SetupNeeded() {
  return (
    <html lang="en" className={`${nunito.variable} ${fraunces.variable}`}>
      <body className="min-h-screen">
        <main className="mx-auto max-w-xl px-4 py-12">
          <div className="card space-y-4 p-6">
            <Wordmark className="h-10 w-auto" />
            <h1 className="text-3xl font-semibold">One setup step left</h1>
            <p className="text-lg">Ladle needs a database to save your recipes and plans, and none is connected to this site yet.</p>
            <ol className="list-decimal space-y-2 pl-6 text-lg">
              <li>In Vercel, open this project and go to <b>Storage</b>.</li>
              <li>Create or connect a <b>Neon Postgres</b> database. That adds <code>DATABASE_URL</code> for you.</li>
              <li>Go to <b>Deployments</b> and redeploy the latest one.</li>
            </ol>
          </div>
        </main>
      </body>
    </html>
  );
}
