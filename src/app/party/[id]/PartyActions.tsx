"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addPartyToList, removeParty } from "@/app/actions/party";

/** Add the party's shopping to the week's grocery list, print it, or take the party off. */
export function PartyActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="no-print space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={pending}
          onClick={() => start(async () => { const r = await addPartyToList(id); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Added to your grocery list, in its own section." }); })}>
          {pending ? "Adding…" : "🛒 Add to my grocery list"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>🖨️ Print</button>
        <button type="button" className="btn-quiet" disabled={pending} onClick={() => { if (confirm("Remove this party? Its shopping comes off your grocery list too.")) start(() => removeParty(id)); }}>Remove</button>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm font-bold ${msg.ok ? "text-olive-dark" : "text-terracotta-dark"}`}>
          {msg.text} {msg.ok && <Link href="/" className="underline">See the list</Link>}
        </p>
      )}
    </div>
  );
}
