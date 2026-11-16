// Ladle's service worker: makes the app open fast and keeps the last-seen pages (like this week's grocery
// list) readable in the store when the signal drops. Pages always come from the network first; the saved
// copy is only used when the network fails.
const VERSION = "ladle-v1";
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Signing out (or switching accounts) clears the saved pages.
self.addEventListener("message", (event) => {
  if (event.data === "clear") event.waitUntil(caches.delete(PAGES));
});

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ladle</title><style>body{font-family:system-ui,sans-serif;background:#F8F4EC;color:#2E3324;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}
h1{font-size:1.6rem;margin:.3rem 0}p{color:#6B6F5E;max-width:22rem}button{margin-top:1rem;background:#5E6B47;color:#F8F4EC;border:0;border-radius:999px;padding:.8rem 1.4rem;font-weight:700;font-size:1rem}</style></head>
<body><div><div style="font-size:3rem">🥄</div><h1>You're offline</h1><p>Ladle needs a connection for this page. Pages you opened recently, like this week's grocery list, still work.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // actions and sign-in go straight to the server
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // App code and fonts never change once built: cache them for speed.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: network first, keep a copy, fall back to the copy (or an offline note) without a connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected && !/^\/(login|signup|join)/.test(url.pathname)) {
            const copy = res.clone();
            caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) ?? new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
  }
});

// Phone alerts: show what the server sent, and open the right page when it's tapped.
self.addEventListener("push", (event) => {
  let msg = { title: "Ladle", body: "", url: "/", tag: "ladle" };
  try { msg = { ...msg, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, tag: msg.tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: msg.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);
  if (url.origin !== self.location.origin) return; // only ever open Ladle's own pages
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === url.origin);
      if (open) return open.navigate(url.href).then((w) => w && w.focus());
      return self.clients.openWindow(url.href);
    }),
  );
});
