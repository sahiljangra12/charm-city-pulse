/* Map layers shared by the map and My block.
   Static layers come from the daily build (instant); live ones refresh in the browser. */
const LAYERS = (() => {
  const D = () => APP.data;
  const DEF = {
    cool:      { label: "Cooling centers", icon: "snow", color: "#1d6fb8" },
    warm:      { label: "Warming centers & shelters", icon: "flame", color: "#d26a1c" },
    parks:     { label: "Parks", icon: "tree", color: "#24804f", file: "parks.geojson", poly: true },
    pools:     { label: "Public pools", icon: "pool", color: "#2f7fb5", file: "pools.geojson" },
    rec:       { label: "Rec centers", icon: "ball", color: "#6b4c9a", file: "rec_centers.geojson" },
    fountains: { label: "Water fountains", icon: "fountain", color: "#1d8fc9", file: "osm_fountains.geojson" },
    transit:   { label: "Rail stations", icon: "train", color: "#6b4c9a", file: "osm_transit.geojson" },
    bike:      { label: "Bike lanes", icon: "bike", color: "#d26a1c", file: "osm_bike.geojson", line: true },
    ev:        { label: "EV chargers", icon: "plug", color: "#b98500", file: "osm_ev.geojson" },
    gardens:   { label: "Community gardens", icon: "sprout", color: "#5e9e2f", file: "osm_gardens.geojson" },
    recycling: { label: "Recycling drop-off", icon: "recycle", color: "#3f7f8c", file: "osm_recycling.geojson" },
    markets:   { label: "Farmers markets", icon: "basket", color: "#b8382b", file: "osm_markets.geojson" },
    flood:     { label: "Flood zones", icon: "waves", color: "#3d7fb2" },
    gauges:    { label: "Stream gauges (live)", icon: "droplet", color: "#0e2a3b" },
    airmon:    { label: "Air monitors (live)", icon: "wind", color: "#24804f" },
    foodsites: { label: "Food distribution sites", icon: "hands", color: "#2f8a5b" },
    snap:      { label: "Groceries that take SNAP", icon: "basket", color: "#b8382b" },
    stops:     { label: "Bus and rail stops", icon: "bus", color: "#6b4c9a" },
    harbor:    { label: "Harbor water quality", icon: "waves", color: "#1d6fb8" },
    sensors:   { label: "Neighborhood air sensors", icon: "wind", color: "#24804f" },
  };
  const dot = (lat, lon, color, r = 7) => L.circleMarker([lat, lon], { radius: r, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 });
  const pinMk = (lat, lon, d) => L.marker([lat, lon], { icon: L.divIcon({ className: "", html: `<div class="mpin" style="--c:${d.color}">${I(d.icon, 15)}</div>`, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -12] }) });
  const dir = (lat, lon) => `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener">Directions</a>`;
  const cache = {};
  async function file(name) { return cache[name] || (cache[name] = U.getJSON("data/" + name).catch(e => { delete cache[name]; throw e; })); }

  /** returns a Leaflet layer; `opts.pins` uses icon pins; `opts.onCount(n)` reports features */
  async function load(key, opts = {}) {
    const d = DEF[key], C = D().centers, mk = (lat, lon) => opts.pins ? pinMk(lat, lon, d) : dot(lat, lon, d.color);
    if (key === "cool") { opts.onCount?.(C.cooling.length); return L.layerGroup(C.cooling.map(c => mk(c.lat, c.lon).bindPopup(`<h4>${U.esc(c.name)}</h4>${U.esc(c.address)}<br><small>${U.esc(c.hours || "")}</small><br><small>Opens on Code Red heat days. Call 311 to confirm.</small><br>${dir(c.lat, c.lon)}`))); }
    if (key === "warm") { const s = C.winter.sites.filter(x => x.lat != null); opts.onCount?.(s.length); return L.layerGroup(s.map(x => mk(x.lat, x.lon).bindPopup(`<h4>${U.esc(x.name)}</h4>${U.esc(x.address)}<br><small>${U.esc(x.hours)}${x.serves && x.serves !== "All" ? ", " + U.esc(x.serves) : ""}</small><br><small>Nov 15 to Mar 15, on cold days. Shelter Hotline 443-984-9540.</small><br>${dir(x.lat, x.lon)}`))); }
    if (key === "foodsites" || key === "snap") {
      const f = await MORE.file("food.json"), list = key === "snap" ? (f.snap || []).filter(s => s.grocery) : (f.sites || []);
      opts.onCount?.(list.length);
      return L.layerGroup(list.map(x => mk(x.lat, x.lon).bindPopup(`<h4>${U.esc(x.name)}</h4>${U.esc(x.address)}<br><small>${key === "snap" ? "Takes SNAP (EBT)" + (x.type ? ", " + U.esc(x.type) : "") : "City food distribution site. Call 211 to confirm hours."}</small><br>${dir(x.lat, x.lon)}`)));
    }
    if (key === "harbor") {
      const h = await MORE.file("harbor.json"); opts.onCount?.(h.sites.length);
      return L.layerGroup(h.sites.map(x => { const ok = /pass/i.test(x.status);
        return L.circleMarker([x.lat, x.lon], { radius: 9, color: "#fff", weight: 2, fillColor: ok ? "#1e9e5a" : "#d6283b", fillOpacity: 1 })
          .bindPopup(`<h4>${U.esc(x.name)}</h4>${ok ? "Passing" : "Advisory: avoid contact"}<br><small>Bacteria ${x.count ?? "—"}, sampled ${U.esc(x.date || "")}</small><br><small>Waterfront Partnership, ${U.esc(h.season)}</small>`); }));
    }
    if (key === "sensors") {
      const s = await MORE.sensors(); opts.onCount?.(s.length);
      return L.layerGroup(s.map(x => { const c = LIVE.aqiCat(x.aqi);
        return L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "", html: `<div style="width:28px;height:28px;line-height:24px;border-radius:6px;text-align:center;font:700 11px var(--font);background:${c.c};border:2px solid #fff;color:#fff">${x.aqi}</div>`, iconSize: [28, 28] }) })
          .bindPopup(`<h4>${U.esc(x.name)}</h4>Air quality about <b>${x.aqi}</b>, ${c.t}<br><small>PM2.5 ${x.pm25} µg/m³, low-cost sensor${x.provider ? " (" + U.esc(x.provider) + ")" : ""}, ${U.timeAgo(x.time)}</small><br><small>Sensors are less accurate than EPA monitors.</small>`); }));
    }
    if (key === "stops") {
      // stops load by map area once zoomed in, so the map stays fast
      const g = L.layerGroup(), shown = new Set(), map = opts.map;
      const hm = t => t.toLocaleTimeString(LOC(), { hour: "numeric", minute: "2-digit" });
      const draw = async () => {
        if (!map || map.getZoom() < 15) { g.clearLayers(); shown.clear(); opts.onCount?.(0); return; }
        const c = map.getCenter(), groups = await MORE.stopsNear(c.lat, c.lng, 60, 1.2).catch(() => []);
        groups.forEach(gr => gr.forEach(s => { if (shown.has(s.id)) return; shown.add(s.id);
          L.circleMarker([s.lat, s.lon], { radius: 6, color: "#fff", weight: 2, fillColor: s.mode === "bus" ? "#6b4c9a" : "#b98500", fillOpacity: 1 }).addTo(g)
            .bindPopup(() => { const nx = MORE.upcoming([s], 4); return `<h4>${U.esc(s.name)}</h4><small>${MORE.MODE[s.mode]?.[1] || "Stop"}</small><br>${nx.length ? nx.map(x => `<b>${U.esc(x.route)}</b> ${U.esc(x.head)}: ${hm(x.t)}`).join("<br>") : "<small>No more scheduled service in the next 3 hours.</small>"}<br><small>Scheduled times (MTA)</small>`; }); }));
        opts.onCount?.(shown.size);
      };
      if (map) { map.on("moveend", draw); g._unsub = () => map.off("moveend", draw); }
      draw(); return g;
    }
    if (key === "flood") { opts.onCount?.(null); return L.esri.dynamicMapLayer({ url: LIVE.NFHL, layers: [LIVE.floodLayer()], opacity: .55, f: "image" }); }
    if (key === "gauges") {
      const g = L.layerGroup();
      g._unsub = LIVE.feeds.water.on(s => { g.clearLayers(); (s || []).forEach(x => {
        L.marker([x.coords[1], x.coords[0]], { icon: L.divIcon({ className: "", html: `<div class="pulse-mk" style="width:14px;height:14px;background:#0c1c2c;border:2px solid #fff"></div>`, iconSize: [14, 14] }) })
          .bindPopup(`<h4>${U.esc(RES.short(x.name))}</h4>${Object.entries(x.readings).map(([pc, r]) => `${LIVE.PCODES[pc].name}: <b>${U.fmt(r.value, pc === "00060" ? 0 : 1)} ${U.esc(r.unit)}</b>`).join("<br>")}<br><small>${U.timeAgo(Object.values(x.readings)[0].time)}, USGS ${U.esc(x.id.replace("USGS-", ""))}</small>`).addTo(g); }); opts.onCount?.((s || []).length); });
      return g;
    }
    if (key === "airmon") {
      const g = L.layerGroup();
      g._unsub = LIVE.feeds.airnow.on(s => { g.clearLayers(); (s || []).forEach(x => { const c = LIVE.aqiCat(x.aqi);
        L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "", html: `<div style="width:32px;height:32px;line-height:28px;border-radius:50%;text-align:center;font:700 12px var(--font);background:${c.c};border:2px solid #fff;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${Math.round(x.aqi)}</div>`, iconSize: [32, 32] }) })
          .bindPopup(`<h4>${U.esc(x.name)}</h4>Air quality <b>${Math.round(x.aqi)}</b>, ${c.t}<br>${Object.entries(x.readings).map(([p, r]) => `${U.esc(p)}: ${Math.round(r.aqi)}`).join("<br>")}<br><small>EPA AirNow${x.time ? ", " + U.timeAgo(x.time) : ""}</small>`).addTo(g); }); opts.onCount?.((s || []).length); });
      return g;
    }
    // static files from the daily build, with a live OpenStreetMap fallback
    let gj;
    try { gj = await file(d.file); }
    catch (e) {
      const osmKey = key in LIVE.OSM ? key : null; if (!osmKey) throw e;
      const els = await LIVE.osm(osmKey);
      gj = { type: "FeatureCollection", features: els.map(x => x.geometry && x.geometry.length > 1 ? { type: "Feature", properties: x.tags || {}, geometry: { type: "LineString", coordinates: x.geometry.map(p => [p.lon, p.lat]) } } :
        { type: "Feature", properties: x.tags || {}, geometry: { type: "Point", coordinates: [x.lon ?? x.center?.lon, x.lat ?? x.center?.lat] } }).filter(f => f.geometry.coordinates[0] != null) };
    }
    opts.onCount?.(gj.features.length);
    const pop = p => `<h4>${U.esc(p.name || d.label.replace(/s$/, ""))}</h4>${p.address ? U.esc(p.address) + "<br>" : ""}${p.operator ? U.esc(p.operator) + "<br>" : ""}${p.opening_hours ? "<small>" + U.esc(p.opening_hours) + "</small><br>" : ""}${p.acres ? `<small>${U.fmt(p.acres, 1)} acres</small><br>` : ""}`;
    return L.geoJSON(gj, {
      style: d.line ? { color: d.color, weight: 3, opacity: .85 } : { color: d.color, weight: 1, fillOpacity: .3 },
      pointToLayer: (f, ll) => mk(ll.lat, ll.lng),
      onEachFeature: (f, l) => { const c = f.geometry.type === "Point" ? f.geometry.coordinates : null; l.bindPopup(pop(f.properties) + (c ? dir(c[1], c[0]) : "")); },
    });
  }
  return { DEF, load, dot };
})();
