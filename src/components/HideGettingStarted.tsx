"use client";

import { useTransition } from "react";
import { markSectionSeen } from "@/app/actions/settings";

/** "Hide this list": for families who'd rather find things on their own. */
export function HideGettingStarted() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="text-sm font-bold text-muted underline" disabled={pending} onClick={() => start(() => markSectionSeen("getting-started-hidden"))}>
      Hide this list
    </button>
  );
}
