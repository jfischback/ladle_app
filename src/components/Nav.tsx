"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function PotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...S}>
      <path d="M9 4.5c-.6.8-.6 1.7 0 2.5M13 4c-.6.8-.6 1.7 0 2.5" />
      <path d="M3 10h18M5 10v6a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-6M2.5 12.5H5M19 12.5h2.5" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...S}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
      <path d="M12 7.5c-1.2-1-3 0-2.2 1.6.5 1 2.2 2.2 2.2 2.2s1.7-1.2 2.2-2.2c.8-1.6-1-2.6-2.2-1.6z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...S}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 3v4h4" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...S}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "This Week", icon: PotIcon },
  { href: "/recipes", label: "Recipes", icon: BookIcon },
  { href: "/history", label: "History", icon: ClockIcon },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

/** Pill links in the header, on tablets and computers. */
export function NavLinks() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="hidden gap-1 sm:flex">
      {LINKS.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold transition-colors ${active ? "bg-olive text-cream shadow-soft" : "text-olive-dark hover:bg-olive-soft"}`}
          >
            <l.icon />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar on phones, like a real app. */
export function TabBar() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-3 bottom-3 z-40 rounded-[2rem] bg-card/95 shadow-lift ring-1 ring-line/60 backdrop-blur sm:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {[...LINKS, { href: "/setup", label: "Settings", icon: GearIcon }].map((l) => {
          const active = isActive(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold ${active ? "text-terracotta" : "text-muted"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? "bg-terracotta-soft" : ""}`}>
                  <l.icon />
                </span>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
