/* Core: data, routing, modes, units, theme, maps, ticker, address search, live data-release watcher */
const APP = (() => {
  const TABS = {
    resident: [["today", "Today"], ["plan", "Plan"], ["place", "My block"], ["map", "Map"], ["help", "Get help"]],
    research: [["conditions", "Live conditions"], ["explore", "Indicator explorer"], ["layers", "Map layers"], ["report", "Area report"], ["compare", "Compare"], ["correlate", "Correlate"], ["live", "Live feeds"], ["download", "Download"], ["refs", "References"], ["about", "Methods"]],
  };
  const SHARED = ["refs", "about"];
  const VIEWS = {}; const inited = {};
  const A = { data: null, maps: [], mode: U.store.get("mode", "resident"), view: null };

  // ---------- theme ----------
  function isDark() { const t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; }
  const tileUrl = () => `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/${isDark() ? "World_Dark_Gray_Base" : "World_Light_Gray_Base"}/MapServer/tile/{z}/{y}/{x}`;
  function setTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; U.store.set("theme", t || null); A.maps.forEach(m => { if (!m._ccpFallback) m._ccpTiles.setUrl(tileUrl()); }); document.dispatchEvent(new Event("themechange")); }
  const saved = U.store.get("theme", null); if (saved) document.documentElement.dataset.theme = saved;

  function makeMap(elId, opts = {}) {
    const m = L.map(elId, { zoomControl: true, scrollWheelZoom: opts.scroll !== false, attributionControl: true }).setView(LIVE.CENTER, opts.zoom || 12);
    m._ccpTiles = L.tileLayer(tileUrl(), { maxZoom: 16, maxNativeZoom: 16, attribution: 'Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors' }).addTo(m);
    m._ccpTiles.on("tileerror", () => { if (m._ccpFallback) return; m._ccpFallback = true; m._ccpTiles.setUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png"); m._ccpTiles.options.attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'; });
    A.maps.push(m); return m;
  }
  function legend(map, title, items) {
    if (map._ccpLegend) map.removeControl(map._ccpLegend);
    const c = L.control({ position: "bottomright" });
    c.onAdd = () => { const d = L.DomUtil.create("div", "legend"); d.innerHTML = `<b>${U.esc(title)}</b><br>` + items.map(([col, t]) => `<i style="background:${col}"></i>${U.esc(t)}`).join("<br>"); return d; };
    c.addTo(map); map._ccpLegend = c;
  }
  const NONRES_STYLE = { color: "#8a9aa6", weight: .6, fillOpacity: .6, fillColor: "url(#hatch)" };

  // ---------- data ----------
  async function load(bust = "") {
    const q = bust ? "?b=" + bust : "";
    const [tracts, csaList, catalog, centers, meta, research] = await Promise.all(
      ["tracts.geojson", "csa.json", "catalog.json", "centers.json", "meta.json", "research.json"].map(f => U.getJSON("data/" + f + q, bust ? { cache: "no-store" } : {})));
    const ind = {}; catalog.indicators.forEach(i => ind[i.key] = i);
    const feats = tracts.features; const byId = {}; feats.forEach(f => byId[f.properties.id] = f);
    const res = feats.filter(f => !f.properties.nonres);
    const csa = csaList.sort((a, b) => a.name.localeCompare(b.name)); const csaByName = {}; csa.forEach(c => csaByName[c.name] = c);
    const med = {}; catalog.indicators.forEach(i => med[i.key] = U.quantile(res.map(f => f.properties[i.key]), .5));
    A.data = { tracts, feats, res, byId, catalog, ind, csa, csaByName, centers, meta, research, med };
  }
  function tractAt(lat, lon) { const f = A.data.feats.find(f => U.inGeom([lon, lat], f.geometry)); return f ? f.properties.id : null; }
  function centroid(f) {
    const ring = (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates[0])[0];
    let a = 0, x = 0, y = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const k = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += k; x += (ring[j][0] + ring[i][0]) * k; y += (ring[j][1] + ring[i][1]) * k; }
    return a ? [x / (3 * a), y / (3 * a)] : ring[0];
  }

  // ---------- live data-release watcher: new daily build => hot reload ----------
  function watchReleases() {
    LIVE.feeds.meta.on(async m => {
      if (!m || !A.data || m.built === A.data.meta.built) return;
      try {
        await load(m.built); U.toast("New neighborhood data published " + new Date(m.built).toLocaleDateString() + " — updated.");
        Object.keys(inited).forEach(k => { if (VIEWS[k]?.reload) VIEWS[k].reload(); });
        route();
      } catch (e) { console.warn("reload failed", e); }
    });
  }

  // ---------- ticker ----------
  function ticker() {
    const parts = {};
    const draw = () => {
      const items = Object.values(parts).filter(Boolean);
      if (!items.length) return;
      const html = items.map(t => `<span class="item">${t}</span>`).join("");
      U.$("#tickerTrack").innerHTML = `<span class="item"><span class="livedot"></span><b>LIVE</b></span>` + html + html;
    };
    LIVE.feeds.weather.on(w => { if (!w) return; const c = w.current, fc = LIVE.feelsCat(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m);
      parts.w = `<b>${U.tF(c.temperature_2m)}</b> ${LIVE.WMO[c.weather_code] || ""}`; parts.f = fc && fc.kind !== "mild" ? `${fc.label} <b>${U.tF(fc.index)}</b> · ${fc.t}` : null;
      parts.u = `UV peak <b>${Math.round(w.daily.uv_index_max[0])}</b>`; parts.r = `Rain chance today <b>${w.daily.precipitation_probability_max[0] ?? 0}%</b>`; draw(); });
    const airTick = () => { const v = RES.aqiNow(); if (v.aqi == null) return; parts.a = `Air quality <b>${Math.round(v.aqi)}</b> · ${LIVE.aqiCat(v.aqi).t}${v.site ? " (" + U.esc(v.site) + " monitor)" : ""}`; draw(); };
    LIVE.feeds.air.on(airTick); LIVE.feeds.airnow.on(airTick);
    LIVE.feeds.alerts.on(al => { parts.al = al && al.length ? `⚠ <b>${al.map(x => U.esc(x.event)).join(" · ")}</b>` : "No weather alerts"; draw(); });
    LIVE.feeds.water.on(s => { if (!s) return; const f = s.filter(x => x.readings["00060"]).sort((a, b) => b.readings["00060"].value - a.readings["00060"].value); parts.h = `<b>${s.length}</b> USGS stream gauges reporting${f[0] ? ` · ${U.esc(RES.short(f[0].name))} ${Math.round(f[0].readings["00060"].value)} ft³/s` : ""}`; draw(); });
  }

  // ---------- address search with autocomplete (shared) ----------
  function searchForm(form, onPick) {
    form.innerHTML = `<div class="field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" placeholder="Start typing a Baltimore address…" aria-label="Address" role="combobox" aria-expanded="false" aria-autocomplete="list" required>
      <ul class="suggest" role="listbox"></ul></div><button class="btn">Check</button><button type="button" class="btn alt" data-locate>📍 Use my location</button>`;
    const input = form.querySelector("input"), list = form.querySelector(".suggest"), btn = form.querySelector(".btn");
    let items = [], sel = -1, seq = 0;
    const close = () => { list.classList.remove("on"); input.setAttribute("aria-expanded", "false"); sel = -1; };
    const render = () => {
      list.innerHTML = items.map((s, i) => `<li role="option" aria-selected="${i === sel}" data-i="${i}">${U.esc(s.text)}</li>`).join("");
      list.classList.toggle("on", items.length > 0); input.setAttribute("aria-expanded", String(items.length > 0));
    };
    const go = async item => {
      close(); btn.disabled = true; btn.textContent = "Finding…";
      try { const r = await LIVE.geocode(item || input.value.trim()); if (!r) throw new Error("nf"); input.value = r.label || input.value; onPick(r.lat, r.lon, r.label); }
      catch (e) { onPick(null, null, null, e.message === "nf" ? "We couldn't find that address in Baltimore City. Try the house number and street, e.g. 3400 N Charles St." : "Address search is unavailable right now. Click the map instead."); }
      finally { btn.disabled = false; btn.textContent = "Check"; }
    };
    input.addEventListener("input", U.debounce(async () => {
      const my = ++seq, t = input.value.trim(); if (t.length < 3) { items = []; render(); return; }
      const s = await LIVE.suggest(t); if (my !== seq) return; items = s; sel = -1; render();
    }, 220));
    input.addEventListener("keydown", e => {
      if (!list.classList.contains("on")) return;
      if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(-1, sel - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); input.value = items[sel].text; go(items[sel]); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (!li) return; e.preventDefault(); const it = items[+li.dataset.i]; input.value = it.text; go(it); });
    input.addEventListener("blur", () => setTimeout(close, 150));
    form.addEventListener("submit", e => { e.preventDefault(); if (input.value.trim()) go(sel >= 0 ? items[sel] : null); });
    form.querySelector("[data-locate]").onclick = ev => {
      const b = ev.currentTarget;
      if (!navigator.geolocation) return onPick(null, null, null, "Your browser doesn't share location. Search an address instead.");
      b.textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(p => { b.textContent = "📍 Use my location"; onPick(p.coords.latitude, p.coords.longitude, "Your location"); },
        () => { b.textContent = "📍 Use my location"; onPick(null, null, null, "Location permission was denied. Search an address instead."); }, { timeout: 12000, enableHighAccuracy: true });
    };
  }

  // ---------- routing ----------
  function route() {
    const [name, ...rest] = (location.hash.slice(1) || (A.mode === "research" ? "conditions" : "today")).split("/");
    const owner = SHARED.includes(name) ? (TABS[A.mode].some(t => t[0] === name) ? A.mode : A.mode) : TABS.resident.some(t => t[0] === name) ? "resident" : TABS.research.some(t => t[0] === name) ? "research" : null;
    if (!owner) { location.hash = A.mode === "research" ? "conditions" : "today"; return; }
    if (owner !== A.mode) setMode(owner, false);
    renderTabs(name); A.view = name;
    U.$$("section.view").forEach(s => s.classList.toggle("on", s.id === "v-" + name));
    const v = VIEWS[name];
    if (v) { if (!inited[name] && v.init) { v.init(); inited[name] = true; } v.show && v.show(rest.map(decodeURIComponent)); }
    FX.reveal(U.$("#v-" + name));
    U.$$("#v-" + name + " .place-list, #v-" + name + " .facts, #v-" + name + " .todo, #v-" + name + " .meters, #v-" + name + " .grid.g3, #v-" + name + " .grid.g2").forEach(el => { el.classList.remove("stagger"); void el.offsetWidth; el.classList.add("stagger"); });
    setTimeout(() => A.maps.forEach(m => m.invalidateSize()), 80);
    if (!route.first) window.scrollTo(0, 0); route.first = false;
  }
  function renderTabs(active) {
    U.$("#tabs").innerHTML = TABS[A.mode].map(([k, t]) => `<a href="#${k}" class="${k === active ? "on" : ""}">${t}</a>`).join("");
    U.$$("#appbar a").forEach(a => a.classList.toggle("on", a.dataset.tab === active));
    if (navigator.vibrate && route.touched) navigator.vibrate(6);
  }
  function setMode(m, nav = true) {
    A.mode = m; U.store.set("mode", m);
    document.body.classList.toggle("research", m === "research"); document.body.classList.toggle("resident", m !== "research");
    const b = U.$("#modeBtn"); b.setAttribute("aria-pressed", String(m === "research")); b.textContent = m === "research" ? (innerWidth < 480 ? "Simple" : "Simple view") : (innerWidth < 480 ? "Research" : "Researcher mode");
    if (nav) location.hash = m === "research" ? "conditions" : "today";
  }
  function setUnit(u) {
    U.store.set("unit", u); U.$$("[data-unit]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.unit === u)));
    document.dispatchEvent(new Event("unitchange"));
  }

  // ---------- about ----------
  VIEWS.about = {
    init() { this.show(); },
    show() {
      const { catalog, research } = A.data, ind = A.data.ind;
      U.$("#themeDefs").innerHTML = catalog.themes.map(t => `<li><b>${U.esc(t.label)}</b>: ${t.inputs.map(k => U.esc(ind[k].label.toLowerCase())).join(", ")}</li>`).join("");
      const h = research.heat, t = research.trees;
      U.$("#aboutFindings").innerHTML = `<h3 style="margin-top:14px">Findings behind the app</h3><ul>
        <li>Summer daytime surface temperature differs by about <b>${U.tC(h.lst_range[1] - h.lst_range[0], 0, true)}</b> across Baltimore's census tracts.</li>
        <li>Areas graded "D" (hazardous) on the 1937 redlining maps average <b>${U.tC(h.holc_lst_by_grade.D)}</b> versus ${U.tC(h.holc_lst_by_grade.A)} in "A" areas, with <b>${h.holc_tree_by_grade.D}%</b> tree cover versus ${h.holc_tree_by_grade.A}%.</li>
        <li>${h.veryhigh_n} tracts, home to about ${Math.round(h.veryhigh_pop / 1000)}k people, fall in the very-high heat-vulnerability class.</li>
        <li>Each young street tree cooled its 90 m surroundings by about <b>${U.tC(Math.abs(t.per_tree_c), 3, true)}</b> within a decade of planting (95% CI ${U.tC(Math.abs(t.hi), 3, true)} to ${U.tC(Math.abs(t.lo), 3, true)}); the city had about ${t.vacant_sites.toLocaleString()} empty street-tree sites.</li></ul>`;
    },
    reload() { this.show(); },
  };

  // iOS-style sliding thumb under segmented controls
  function segThumbs() {
    const place = seg => {
      const on = seg.querySelector('button[aria-pressed="true"]'); let th = seg.querySelector(".thumb");
      if (!th) { th = document.createElement("span"); th.className = "thumb"; seg.prepend(th); seg.classList.add("has-thumb"); }
      if (!on) return; th.style.width = on.offsetWidth + "px"; th.style.transform = `translateX(${on.offsetLeft}px)`;
    };
    const all = () => U.$$(".seg").forEach(place);
    new MutationObserver(all).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    addEventListener("resize", all); setTimeout(all, 300); document.fonts?.ready.then(all);
  }
  // gentle parallax on the sky scene
  function parallax() {
    if (FX.reduce) return; let tk = false;
    addEventListener("scroll", () => { if (tk) return; tk = true; requestAnimationFrame(() => { const y = Math.min(scrollY, 400);
      const sc = U.$("#hScene"), ct = U.$("#hSky .content"); if (sc) sc.style.transform = `translateY(${y * .25}px)`; if (ct) ct.style.transform = `translateY(${y * .1}px)`; tk = false; }); }, { passive: true });
  }

  async function start() {
    U.$("#modeBtn").onclick = () => setMode(A.mode === "research" ? "resident" : "research");
    U.$$("[data-unit]").forEach(b => b.onclick = () => setUnit(b.dataset.unit)); setUnit(U.unit());
    U.$("#themeBtn").onclick = () => setTheme(isDark() ? "light" : "dark");
    try { await load(); }
    catch (e) { U.$("main").innerHTML = `<div class="card alert"><h3>Could not load data</h3><p>${U.esc(e.message)}. If you opened the file directly, serve the folder with a local web server (for example <code>python3 -m http.server</code>).</p></div>`; return; }
    U.$("#buildStamp").textContent = "Data build " + new Date(A.data.meta.built).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    Object.assign(VIEWS, RES.views, PLAN.views, COND.views, RSC.views, REFS.views);
    ALERTS.init(); segThumbs(); parallax();
    setMode(A.mode, false); route.first = true;
    addEventListener("hashchange", () => {
      if (document.startViewTransition && !FX.reduce) { const vt = document.startViewTransition(() => route()); vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone.catch(() => {}); } else route();
    }); route();
    ticker(); watchReleases();
    document.addEventListener("unitchange", () => { if (A.view && VIEWS[A.view]?.unit) VIEWS[A.view].unit(); else if (A.view && VIEWS[A.view]?.show) VIEWS[A.view].show(location.hash.slice(1).split("/").slice(1).map(decodeURIComponent)); });
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  Object.assign(A, { makeMap, legend, tractAt, centroid, setMode, isDark, searchForm, NONRES_STYLE, TABS, route });
  document.addEventListener("DOMContentLoaded", start);
  return A;
})();
