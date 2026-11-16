"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { dismissAlert, setNotifyLevel } from "@/app/actions/alerts";
import { NOTIFY_LEVELS, type Alert, type NotifyLevel } from "@/lib/alerts";
import { PushButton } from "./PushButton";

/** Home's alerts: what needs the family today, at the level they chose, each one closable. */
export function AlertsPanel({ alerts, level, pushKey }: { alerts: Alert[]; level: NotifyLevel; pushKey: string | null }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [lvl, setLvl] = useState<NotifyLevel>(level);
  const [pending, start] = useTransition();
  const shown = alerts.filter((a) => !hidden.includes(a.key));
  const label = NOTIFY_LEVELS.find((l) => l.key === lvl)?.label ?? "Just the essentials";
  return (
    <section aria-labelledby="alerts-title" className="no-print space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="alerts-title" className="text-lg font-semibold">🔔 {shown.length ? `For you today (${shown.length})` : "Alerts"}</h2>
        <button type="button" className="text-sm font-bold text-olive-dark underline" aria-expanded={open} onClick={() => setOpen(!open)}>
          {label} · Change
        </button>
      </div>
      {open && (
        <fieldset className="card space-y-2 p-4">
          <legend className="sr-only">How many alerts</legend>
          {NOTIFY_LEVELS.map((l) => (
            <label key={l.key} className="flex cursor-pointer items-start gap-2">
              <input type="radio" name="notify-level" className="mt-1" checked={lvl === l.key} onChange={() => { setLvl(l.key); start(() => setNotifyLevel(l.key)); }} />
              <span><span className="font-bold">{l.label}</span><span className="block text-sm text-muted">{l.blurb}</span></span>
            </label>
          ))}
          {lvl !== "off" && <PushButton publicKey={pushKey} />}
        </fieldset>
      )}
      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((a) => (
            <li key={a.key} className={`flex items-start gap-3 rounded-2xl p-3 shadow-soft ${a.level === "essential" ? "bg-ochre-soft" : "bg-card"}`}>
              <span className="text-xl" aria-hidden="true">{a.icon}</span>
              <Link href={a.href} className="min-w-0 flex-1">
                <span className="block font-bold">{a.title}</span>
                <span className="text-sm text-muted">{a.text}</span>
              </Link>
              <button type="button" aria-label={`Dismiss: ${a.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-muted hover:bg-oat"
                onClick={() => { setHidden((h) => [...h, a.key]); start(() => dismissAlert(a.key)); }}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
