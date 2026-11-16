"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { disconnectKroger, matchCart, sendCart, updateCartLine } from "../actions/cart";
import { cartTotal } from "@/lib/cart-total";
import type { CartLine, CartState } from "@/lib/types";

const money = (n: number) => `$${n.toFixed(2)}`;

export function CartReview({ planId, homeHref, store, site, connected, fulfillment, cart, pantryQuestions, snap }: { planId: string; homeHref: string; store: string; site: string; snap: boolean; connected: boolean; fulfillment: "pickup" | "delivery"; cart: CartState | null; pantryQuestions: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string; reconnect?: boolean } | null>(null);
  const run = (fn: () => Promise<{ error?: string; reconnect?: boolean; sent?: number } | void>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r?.error) setMsg({ tone: "warn", text: r.error, reconnect: r.reconnect });
      else if (r?.sent) setMsg({ tone: "ok", text: `🎉 ${r.sent} item${r.sent === 1 ? "" : "s"} added to your ${store} cart.` });
    });

  const lines = cart?.lines ?? [];
  const { total, count, saved } = cartTotal(lines);
  const needPick = lines.filter((l) => l.quantity > 0 && l.chosen == null).length;
  const sections = [...new Set(lines.map((l) => l.section))];
  const connectHref = `/api/kroger/connect?plan=${planId}`;

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-xl font-semibold">{connected ? `✅ ${store} account connected` : `Connect your ${store} account`}</h2>
          <p className="text-muted">{connected ? `Items go in your cart for ${fulfillment}.` : `Sign in with ${store} once, so Ladle can add things to your cart. Ladle never sees your password and never checks out.`}</p>
        </div>
        {connected ? (
          <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => run(() => disconnectKroger())}>Disconnect</button>
        ) : (
          <a href={connectHref} className="btn-primary">Connect {store}</a>
        )}
      </section>

      {snap && (
        <p className="card bg-olive-soft p-4">💳 <b>Paying with SNAP / EBT:</b> {store} takes EBT on pickup orders. At checkout on {store}&apos;s site, add your EBT card as a payment method; EBT-eligible groceries go on it and anything else (like paper goods) on a second card.</p>
      )}
      {pantryQuestions > 0 && (
        <p className="card bg-ochre-soft p-4">❓ {pantryQuestions} pantry question{pantryQuestions === 1 ? "" : "s"} still open on your <Link href={`${homeHref}#pantry-check`} className="font-bold underline">grocery list</Link>. Answer those first: &ldquo;Need it&rdquo; adds the item here.</p>
      )}

      {!cart ? (
        <section className="card space-y-3 p-5 text-center">
          <p className="text-5xl" aria-hidden="true">🛒</p>
          <p className="text-lg">Ready when you are. We&apos;ll look up everything on this week&apos;s list.</p>
          <button className="btn-warm" disabled={pending} onClick={() => run(() => matchCart(planId))}>{pending ? `Looking at your ${store}…` : `Find my groceries at ${store}`}</button>
        </section>
      ) : (
        <>
          <section className="card sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-2xl font-semibold">{money(total)} <span className="text-base font-normal text-muted">· {count} item{count === 1 ? "" : "s"}</span></p>
              {saved > 0 && <p className="font-bold text-ochre-dark">You save {money(saved)} on sales</p>}
              {needPick > 0 && <p className="text-sm text-terracotta-dark">{needPick} need{needPick === 1 ? "s" : ""} you to pick a product</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-quiet min-h-9 px-3 text-sm" disabled={pending} onClick={() => run(() => matchCart(planId))}>Look again</button>
              {connected ? (
                <button className="btn-primary" disabled={pending || !count} onClick={() => run(() => sendCart(planId))}>{pending ? "Working…" : cart.sentAt ? "Send again" : "Send to my cart"}</button>
              ) : (
                <a href={connectHref} className="btn-primary">Connect to send</a>
              )}
            </div>
          </section>

          {msg && (
            <p className={`card p-4 font-semibold ${msg.tone === "ok" ? "bg-olive-soft text-olive-dark" : "bg-ochre-soft"}`}>
              {msg.text} {msg.reconnect && <a href={connectHref} className="underline">Connect {store}</a>}
            </p>
          )}
          {cart.sentAt && (
            <p className="card bg-olive-soft p-4 text-olive-dark">
              Sent {cart.sentCount} item{cart.sentCount === 1 ? "" : "s"} on {new Date(cart.sentAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.{" "}
              <a href={`${site}/cart`} target="_blank" rel="noreferrer" className="font-bold underline">Open my {store} cart →</a>
              <span className="block text-sm">Sending again adds the items again, so only resend if you emptied the cart.</span>
              <span className="mt-1 block text-sm">After you shop, <Link href="/history" className="font-bold underline">add your receipt total</Link> so Ladle can show what you spent and saved.</span>
            </p>
          )}

          {sections.map((s) => (
            <section key={s} className="card p-5">
              <h2 className="mb-3 text-xl font-semibold text-terracotta-dark">{s}</h2>
              <ul className="space-y-4">
                {lines.filter((l) => l.section === s).map((l) => <Line key={l.key} planId={planId} line={l} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function Line({ planId, line }: { planId: string; line: CartLine }) {
  const [pending, start] = useTransition();
  const set = (patch: { quantity?: number; chosen?: number | null }) => start(() => updateCartLine(planId, line.key, patch));
  const skipped = line.quantity === 0;
  return (
    <li className={`space-y-2 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-bold ${skipped ? "text-muted line-through" : ""}`}>{line.item}</p>
        <div className="flex items-center gap-1">
          {skipped ? (
            <button className="btn-secondary min-h-9 px-3 text-sm" disabled={pending} onClick={() => set({ quantity: 1 })}>Add back</button>
          ) : (
            <>
              <button aria-label={`One less ${line.item}`} className="btn-secondary h-9 min-h-9 w-9 px-0" disabled={pending} onClick={() => set({ quantity: line.quantity - 1 })}>−</button>
              <span className="w-8 text-center font-bold" aria-label="quantity">{line.quantity}</span>
              <button aria-label={`One more ${line.item}`} className="btn-secondary h-9 min-h-9 w-9 px-0" disabled={pending} onClick={() => set({ quantity: line.quantity + 1 })}>+</button>
              <button className="btn-quiet min-h-9 px-2 text-sm" disabled={pending} onClick={() => set({ quantity: 0 })}>Skip</button>
            </>
          )}
        </div>
      </div>
      {!skipped && (
        line.options.length ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {line.options.map((o, i) => {
              const on = line.chosen === i;
              return (
                <button
                  key={o.upc + i}
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => set({ chosen: on ? null : i })}
                  className={`rounded-2xl border-2 p-3 text-left text-sm transition-colors ${on ? "border-olive bg-olive-soft" : "border-line bg-card hover:border-olive/50"}`}
                >
                  <span className="block font-semibold">{o.description}</span>
                  <span className="text-muted">{o.size}{o.aisle ? ` · ${o.aisle}` : ""}</span>
                  {o.warn && <span className="mt-1 block font-bold text-terracotta-dark">⚠︎ {o.warn.replace(/ \(.*\)$/, "")}: not picked for you</span>}
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <b>{money(o.price)}</b>
                    {o.onSale && <><s className="text-muted">{money(o.regular)}</s><span className="tag-sale">Sale</span></>}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">Not found at this store. Grab it in the store, or skip it.</p>
        )
      )}
      {!skipped && line.options.length > 0 && line.chosen == null && <p className="text-sm text-terracotta-dark">Not sure these are right. Tap one, or skip.</p>}
    </li>
  );
}
