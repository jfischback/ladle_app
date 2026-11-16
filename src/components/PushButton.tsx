"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Turn phone alerts on or off for this phone. Hidden when the server hasn't set up phone alerts. */
export function PushButton({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<"checking" | "unsupported" | "blocked" | "off" | "on">("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => setState(s ? "on" : "off")).catch(() => setState("unsupported"));
  }, [publicKey]);

  if (!publicKey) return null;
  const turnOn = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") { setState("blocked"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const r = await savePushSubscription(sub.toJSON());
      if (r.error) { setMsg(r.error); await sub.unsubscribe(); return; }
      setState("on");
      setMsg("Done. You should see a test alert now.");
    } catch {
      setMsg("This phone couldn't turn on alerts. Try again, or check its notification settings.");
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
      setMsg(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1 border-t border-line pt-2">
      <p className="font-bold">📱 Alerts on this phone</p>
      {state === "unsupported" && <p className="text-sm text-muted">This browser can&apos;t show alerts. On an iPhone, add Ladle to your Home Screen first (Share, then Add to Home Screen) and open it from there.</p>}
      {state === "blocked" && <p className="text-sm text-muted">Alerts are blocked for Ladle in this phone&apos;s settings. Allow notifications there, then come back.</p>}
      {state === "off" && <button type="button" className="btn-secondary min-h-10 px-4 text-sm" disabled={busy} onClick={turnOn}>{busy ? "Turning on…" : "Turn on phone alerts"}</button>}
      {state === "on" && (
        <p className="text-sm">
          On for this phone. <button type="button" className="font-bold text-olive-dark underline" disabled={busy} onClick={turnOff}>Turn off</button>
        </p>
      )}
      {msg && <p role="status" className="text-sm font-semibold text-olive-dark">{msg}</p>}
    </div>
  );
}
