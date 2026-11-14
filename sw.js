// Offline shell. Network first for everything on this site; the cached copy is the offline fallback.
const V = "ccp-202611141601";
const SHELL = ["./", "index.html", "css/app.css", "css/cinema.css", "js/cinema.js", "js/flag.js", "img/baltimore-flag.png", "css/leaflet.css", "js/icons.js", "js/util.js", "js/i18n.js", "js/live.js", "js/fx.js", "js/layers.js", "js/more.js", "js/city.js", "js/resident.js", "js/details.js", "js/priority.js", "js/planner.js", "js/alerts.js", "js/research.js", "js/refs.js", "js/brief.js", "js/health.js", "js/officials.js", "js/ease.js", "flyer.html", "js/app.js", "img/favicon-32.png", "img/icon-192.png", "manifest.webmanifest", "privacy.html"];
self.addEventListener("install", e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const isData = u.pathname.includes("/data/");
  e.respondWith(fetch(e.request, isData ? { cache: "no-store" } : {}).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
