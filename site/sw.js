// Offline shell. App files: cache-first per build; data & live APIs: network-first.
const V = "ccp-__BUILD__";
const SHELL = ["./", "index.html", "css/app.css", "css/leaflet.css", "js/util.js", "js/live.js", "js/fx.js", "js/layers.js", "js/resident.js", "js/conditions.js", "js/research.js", "js/refs.js", "js/app.js", "icon.svg", "manifest.webmanifest", "privacy.html"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const isData = u.pathname.includes("/data/");
  e.respondWith(fetch(e.request, isData ? { cache: "no-store" } : {}).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: isData })));
});
