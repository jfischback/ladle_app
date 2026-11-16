"use client";

import { useState, useTransition } from "react";
import { compareStores, nearbyStores, saveExtraStores } from "@/app/actions/stores";
import { mapPoints, type Comparison, type NearbyStore, type SavedStore } from "@/lib/store-compare";

const RADII = [5, 10, 25];
type Result = Comparison & { stores: SavedStore[]; items: number };

export function StoresClient({ zip: zip0, home, initial }: { zip: string; home: { locationId: string; name: string } | null; initial: SavedStore[] }) {
  const [zip, setZip] = useState(zip0);
  const [radius, setRadius] = useState(10);
  const [found, setFound] = useState<NearbyStore[] | null>(null);
  const [picked, setPicked] = useState<SavedStore[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const search = () => start(async () => {
    setMsg(null);
    const r = await nearbyStores(zip, radius);
    if (r.error) setMsg({ ok: false, text: r.error });
    else setFound(r.stores ?? []);
  });
  const toggle = (s: NearbyStore) => {
    setPicked((p) => (p.some((x) => x.locationId === s.locationId) ? p.filter((x) => x.locationId !== s.locationId) : p.length >= 4 ? p : [...p, { locationId: s.locationId, name: s.name, address: s.address }]));
  };
  const save = () => start(async () => {
    const r = await saveExtraStores(picked);
    setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Saved." });
  });
  const compare = () => start(async () => {
    setMsg(null);
    const r = await compareStores();
    if (r.error) setMsg({ ok: false, text: r.error });
    else setResult(r.result ?? null);
  });

  // The map is centered on your own store when it's in the results, else on the middle of what was found.
  const located = (found ?? []).filter((s) => s.lat != null && s.lng != null);
  const homeHit = located.find((s) => s.locationId === home?.locationId);
  const center = homeHit ? { lat: homeHit.lat!, lng: homeHit.lng! } : located.length ? { lat: located.reduce((a, s) => a + s.lat!, 0) / located.length, lng: located.reduce((a, s) => a + s.lng!, 0) / located.length } : null;
  const points = center ? mapPoints(center, located, radius) : [];
  const nameOf = (id: string) => result?.stores.find((s) => s.locationId === id)?.name ?? id;

  return (
    <div className="space-y-5">
      <section aria-labelledby="find-title" className="card space-y-3 p-5">
        <h2 id="find-title" className="text-xl font-semibold">Find stores near you</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">Zip code</span>
            <input className="field w-28" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="block"><span className="label">Within</span>
            <select className="field" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {RADII.map((r) => <option key={r} value={r}>{r} miles</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" disabled={pending || zip.length !== 5} onClick={search}>{pending && !found ? "Looking…" : "Find stores"}</button>
        </div>

        {found && center && points.length > 0 && (
          <figure className="mx-auto max-w-sm">
            <svg viewBox="0 0 100 100" role="img" aria-label={`Map of ${points.length} stores within ${radius} miles`} className="w-full rounded-2xl bg-olive-soft">
              {[1, 0.5].map((f) => <circle key={f} cx="50" cy="50" r={48 * f} fill="none" stroke="currentColor" strokeOpacity="0.2" className="text-olive-dark" />)}
              <text x="50" y="4.5" textAnchor="middle" fontSize="3" className="fill-muted">N</text>
              <text x="97" y="52" textAnchor="end" fontSize="2.6" className="fill-muted">{radius} mi</text>
              <text x="74" y="52" textAnchor="middle" fontSize="2.6" className="fill-muted">{radius / 2}</text>
              {points.map((p) => {
                const isHome = p.id === home?.locationId;
                const on = picked.some((x) => x.locationId === p.id);
                return <circle key={p.id} cx={p.x * 100} cy={p.y * 100} r={isHome ? 3 : 2.3} className={isHome ? "fill-terracotta" : on ? "fill-olive-dark" : "fill-card"} stroke="#4f5b3a" strokeWidth="0.6" />;
              })}
            </svg>
            <figcaption className="mt-1 text-center text-xs text-muted">🔴 your store · 🟢 picked to compare · ⚪ others</figcaption>
          </figure>
        )}

        {found && (
          found.length ? (
            <fieldset>
              <legend className="mb-1 font-bold">Compare with (up to 4)</legend>
              <ul className="space-y-1.5">
                {found.map((s) => {
                  const isHome = s.locationId === home?.locationId;
                  const miles = points.find((p) => p.id === s.locationId)?.miles;
                  return (
                    <li key={s.locationId}>
                      <label className={`flex items-start gap-2 rounded-xl p-2 ${isHome ? "bg-terracotta-soft" : "bg-cream"}`}>
                        <input type="checkbox" className="mt-1" disabled={isHome} checked={isHome || picked.some((x) => x.locationId === s.locationId)} onChange={() => toggle(s)} />
                        <span>
                          <span className="font-semibold">{s.name}</span>{isHome && <span className="ml-1 text-sm font-bold text-terracotta-dark">(your store)</span>}
                          <span className="block text-sm text-muted">{s.address}{miles != null && homeHit && !isHome ? ` · ${miles} mi from your store` : ""}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : <p className="text-muted">No Kroger-family stores within {radius} miles. Try a wider distance.</p>
        )}
        {picked.length > 0 && (
          <p className="text-sm"><span className="font-bold">Comparing with: </span>{picked.map((p) => p.name).join(", ")}</p>
        )}
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>Save my stores</button>
      </section>

      <section aria-labelledby="compare-title" className="card space-y-3 p-5">
        <h2 id="compare-title" className="text-xl font-semibold">Where is this week&apos;s list cheapest?</h2>
        <p className="text-muted">Checks up to 15 things on your list at each store. It takes a little while.</p>
        <button type="button" className="btn-secondary" disabled={pending || !picked.length} onClick={compare}>{pending && found !== null ? "Working…" : "Compare my stores"}</button>
        {result && (
          <div className="space-y-3">
            {result.cheapest && (
              <p className="rounded-2xl bg-ochre-soft p-3 font-bold">
                🏆 {nameOf(result.cheapest)} is cheapest for the {result.shared} things every store had: ${result.totals.find((t) => t.locationId === result.cheapest)!.total.toFixed(2)}
                {result.totals.length > 1 && ` (vs ${result.totals.filter((t) => t.locationId !== result.cheapest).map((t) => `$${t.total.toFixed(2)} at ${nameOf(t.locationId)}`).join(", ")})`}.
              </p>
            )}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Prices at each store">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-1.5 pr-2">Item</th>
                    {result.stores.map((s) => <th key={s.locationId} className="py-1.5 pr-2">{s.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.item} className="border-b border-line">
                      <td className="py-1.5 pr-2 font-semibold">{r.item}</td>
                      {result.stores.map((s) => {
                        const p = r.prices[s.locationId];
                        return (
                          <td key={s.locationId} className={`py-1.5 pr-2 ${r.best === s.locationId ? "font-bold text-olive-dark" : ""}`}>
                            {p ? <>${p.price.toFixed(2)}{p.onSale && " 🏷️"}{r.best === s.locationId && <span className="sr-only"> (cheapest)</span>}</> : <span className="text-muted">not found</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Bold is the cheapest; 🏷️ is on sale. Store brands and sizes differ, so treat it as a guide. Your cart still goes to your own store.</p>
          </div>
        )}
      </section>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`font-bold ${msg.ok ? "text-olive-dark" : "text-terracotta-dark"}`}>{msg.text}</p>}
    </div>
  );
}
