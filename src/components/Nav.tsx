"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/recipes", label: "Recipes" },
  { href: "/history", label: "History" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-2 font-semibold sm:px-4 ${active ? "bg-olive text-cream" : "text-olive-dark hover:bg-olive-soft"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
