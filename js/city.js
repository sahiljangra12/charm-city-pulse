/* City services for one address: trash and recycling day, street and alley sweeping, snow emergency routes,
   City Council member, and the closest library, free Wi-Fi, garden, drop-off center and senior center.
   Also "Open now" labels from posted hours, and the map layers for all of these.
   Data: pipeline/services.py (Baltimore DPW, DOT, Health Department, Open Baltimore, BNIA, UMBC), rebuilt daily. */
const CITY = (() => {
  const svc = () => MORE.file("services.json");
  const geo = n => MORE.file("services/" + n + ".geojson");
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const tile = (ic, c) => `<span class="tile" style="--tc:${c}">${I(ic, 22)}</span>`;
  const dirBtn = (lat, lon, name) => `<a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(name)}" title="Directions">${I("nav", 18)}</a>`;
  const ext = (u, t) => `<a href="${U.esc(u)}" target="_blank" rel="noopener">${t}</a>`;
  const dayFmt = d => d.toLocaleDateString(LOC(), { weekday: "long", month: "short", day: "numeric" });
  const hm = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString(LOC(), { hour: "numeric", minute: m ? "2-digit" : undefined }); };

  // ---------- when is the next pickup ----------
  function next(dayName, now = new Date()) {
    const i = DAYS.findIndex(d => dayName && dayName.toLowerCase().startsWith(d.toLowerCase().slice(0, 3)));
    if (i < 0) return null;
    const d = new Date(now); d.setHours(12, 0, 0, 0);
    let k = (i - now.getDay() + 7) % 7;
    if (k === 0 && now.getHours() >= 12) k = 7;            // collection starts at 6 am; after noon, point to next week
    d.setDate(d.getDate() + k); return { date: d, inDays: k };
  }
  const when = n => n.inDays === 0 ? "today" : n.inDays === 1 ? "tomorrow" : dayFmt(n.date);

  // ---------- "Open now" from posted hours like "Mon–Fri 9 am–4 pm" or "10:00am-2:00pm Monday-Friday" ----------
  const DN = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function parseHours(s) {
    if (!s) return null; const t = s.toLowerCase().replace(/[–—]/g, "-").replace(/\./g, "");
    if (/24 hours|24\/7/.test(t)) return { always: true };
    if (/between|until|vary|varies|regular/.test(t)) return null;
    let days = null;
    const r = t.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:-|to|through)\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/);
    if (r) { const a = DN.indexOf(r[1]), b = DN.indexOf(r[2]); days = []; for (let k = a; ; k = (k + 1) % 7) { days.push(k); if (k === b) break; } }
    else if (/weekdays/.test(t)) days = [1, 2, 3, 4, 5];
    else if (/daily|every day|7 days/.test(t)) days = [0, 1, 2, 3, 4, 5, 6];
    const tm = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (!days || !tm) return null;
    const to24 = (h, m, ap) => { h = +h % 12; if (ap === "pm") h += 12; return h * 60 + (+m || 0); };
    const close = to24(tm[4], tm[5], tm[6]); let open = to24(tm[1], tm[2], tm[3] || tm[6]);
    if (!tm[3] && open >= close) open = to24(tm[1], tm[2], "am");
    return { days, open, close };
  }
  /** { open: bool, text } or null when the hours can't be read reliably */
  function openNow(hours, now = new Date()) {
    const h = parseHours(hours); if (!h) return null;
    if (h.always) return { open: true, text: "Open 24 hours" };
    const mins = now.getHours() * 60 + now.getMinutes(), today = now.getDay(), t = m => hm(Math.floor(m / 60), m % 60);
    if (h.days.includes(today) && mins >= h.open && mins < h.close) return { open: true, text: `Open now, until ${t(h.close)}` };
    if (h.days.includes(today) && mins < h.open) return { open: false, text: `Closed now, opens at ${t(h.open)}` };
    for (let k = 1; k <= 7; k++) { const d = (today + k) % 7; if (h.days.includes(d)) return { open: false, text: `Closed now, opens ${k === 1 ? "tomorrow" : DAYS[d]} at ${t(h.open)}` }; }
    return null;
  }
  const openBadge = o => o ? `<span class="openb ${o.open ? "on" : ""}">${I("clock", 14)}${U.esc(o.text)}</span>` : "";

  // ---------- geometry ----------
  const metersToSeg = (p, a, b) => {           // equirectangular, fine at city scale
    const k = Math.cos(p[1] * Math.PI / 180) * 111320, kk = 110540;
    const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * kk, bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * kk;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    return Math.hypot(ax + t * dx, ay + t * dy);
  };
  function nearestLine(fc, lon, lat) {
    let best = { m: Infinity };
    fc.features.forEach(f => (f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates]).forEach(path => {
      for (let i = 1; i < path.length; i++) { const m = metersToSeg([lon, lat], path[i - 1], path[i]); if (m < best.m) best = { m, f }; } }));
    return best;
  }
  const inside = (fc, lon, lat) => fc.features.filter(f => U.inGeom([lon, lat], f.geometry));
  const nearest = (list, lat, lon, n = 1) => (list || []).map(x => ({ ...x, d: U.km([lon, lat], [x.lon, x.lat]) })).sort((a, b) => a.d - b.d).slice(0, n);

  /** Everything for one point. */
  async function at(lat, lon) {
    const [S, trash, sweep, snow, council] = await Promise.all([svc(), geo("trash"), geo("sweep"), geo("snow"), geo("council")].map(p => p.catch(() => null)));
    const tz = trash && inside(trash, lon, lat)[0]?.properties;
    const sw = sweep ? inside(sweep, lon, lat).map(f => f.properties) : [];
    const sn = snow ? nearestLine(snow, lon, lat) : null;
    const cd = council && inside(council, lon, lat)[0]?.properties;
    return { S, trash: tz, sweep: sw, snow: sn && sn.f ? { m: sn.m, street: sn.f.properties.street } : null, council: cd };
  }

  /** "Your city services" cards for My block. `exact` = we have the person's address, not just the area. */
  async function section(el, lat, lon, exact) {
    if (!el) return;
    let A; try { A = await at(lat, lon); } catch { el.innerHTML = `<p class="note">City services didn't load. Try again in a minute.</p>`; return; }
    const rows = [], S = A.S || {};
    const approx = exact ? "" : `<small class="muted">For the middle of this area. Search your address above for your exact street.</small>`;
    if (A.trash) {
      const nt = next(A.trash.trash), nr = next(A.trash.recycling), evening = /evening/i.test(A.trash.trash);
      rows.push(`<div class="place svc">${tile("trash", "var(--ink-2)")}<div><b>${evening ? `Trash and recycling: ${U.esc(A.trash.trash)}` : `Trash: ${U.esc(A.trash.trash)} · Recycling: ${U.esc(A.trash.recycling)}`}</b>
        ${nt && !evening ? `<small>Next trash pickup <strong>${when(nt)}</strong>${nr ? `, next recycling <strong>${when(nr)}</strong>` : ""}. Pickup starts at 6 a.m. (5 a.m. in summer), so set cans out the night before, after 6 p.m.</small>` : ""}${approx}
        <small>${ext("https://www.baltimorecity.gov/publicworks/trash-recycling/find-your-trash-recycling-collection-day", "Check with Public Works")} · Holidays can shift pickup by a day.</small></div></div>`);
    }
    rows.push(`<div class="place svc">${tile("home", "var(--s3)")}<div><b>Big items: free bulk pickup</b><small>Up to 3 big items (furniture, mattresses, appliances, up to 4 tires without rims) a month, picked up on a Saturday. Call 311 at least 4 working days before, mark items "bulk collection", and set them out by 7 a.m. No building materials, auto parts, paint or hazardous waste.</small>
      <small>${ext("https://www.baltimorecity.gov/publicworks/trash-recycling/bulk-trash-pickup-and-large-item-removal", "Bulk pickup rules")} · ${ext("https://balt311.baltimorecity.gov/citizen/s/", "Request on 311 online")}</small></div><div class="go"><a class="round call" href="tel:311" aria-label="Call 311" title="Call 311">${I("phone", 20)}</a></div></div>`);
    const alley = A.sweep.find(s => s.kind === "alley"), street = A.sweep.find(s => s.kind === "street");
    if (alley || street) rows.push(`<div class="place svc">${tile("broom", "#3f7f8c")}<div><b>${alley ? `Alley sweeping: ${U.esc(alley.note)}` : "Street sweeping"}</b><small>${street ? U.esc(street.note.replace(/^[A-Za-z ]+:\s*/, "")) + "." : ""} Move your car when the posted sweeping signs say so, or you can get a ticket.</small><small>${ext("https://www.baltimorecity.gov/publicworks/city-cleaning-services/mechanical-street-sweeping", "Sweeping schedule")}</small></div></div>`);
    if (A.snow) {
      const on = A.snow.m <= (exact ? 35 : 0), close = !on && A.snow.m < 160, live = LIVE.snowEmergency?.();
      rows.push(`<div class="place svc ${on && live ? "warnrow" : ""}">${tile("car", on ? "var(--s4)" : "var(--link)")}<div><b>${on ? `Your street is a snow emergency route (${U.esc(A.snow.street)})` : close ? `A snow emergency route is right nearby: ${U.esc(A.snow.street)}` : `Nearest snow emergency route: ${U.esc(A.snow.street)}, ${U.dist(A.snow.m / 1000)} away`}</b>
        <small>${close ? "Check the signs on your block to see if your own street is one. " : ""}${on ? "When the city declares a snow emergency, you can't park here: cars get a $52 ticket and can be towed." : "When the city declares a snow emergency, cars can't park on these routes ($52 ticket, and towing). Look for black-and-white signs high on the pole."}
        ${live ? " <strong>A snow emergency is in effect now.</strong>" : ""}</small>${exact ? "" : `<small class="muted">Search your exact address to check your own street.</small>`}
        <small>${ext("https://www.baltimorecity.gov/transportation/snow-center/parking-during-snow-emergency", "Snow parking rules")} · Towed? Call 410-396-9958.</small></div></div>`);
    }
    if (A.council) rows.push(`<div class="place svc">${tile("users", "#6b4c9a")}<div><b>City Council District ${A.council.district}: ${U.esc(A.council.member || "")}</b><small>Your council member can help with city services that aren't getting fixed.</small>
      <small>${A.council.phone ? `<a href="tel:${A.council.phone.replace(/\D/g, "")}">${U.esc(A.council.phone)}</a>` : ""}${A.council.email ? ` · <a href="mailto:${U.esc(A.council.email)}">${U.esc(A.council.email)}</a>` : ""}</small></div></div>`);
    const lib = nearest(S.libraries, lat, lon)[0], wifi = nearest(S.wifi, lat, lon)[0], gard = nearest(S.gardens, lat, lon)[0], drop = nearest(S.dropoff, lat, lon)[0], sen = nearest(S.seniors, lat, lon)[0];
    const pl = (x, ic, c, t, sub) => x ? `<div class="place">${tile(ic, c)}<div><b>${U.esc(x.name)}</b><small>${t}${x.address ? " · " + U.esc(x.address) : ""}</small>${sub ? `<small>${sub}</small>` : ""}</div><div class="go"><span class="tnum">${U.dist(x.d)}</span>${dirBtn(x.lat, x.lon, x.name)}</div></div>` : "";
    const places = [
      pl(lib, "book", "#8a5a2b", "Library: free Wi-Fi, computers, printing and a warm or cool place to sit", lib?.phone ? `<a href="tel:${lib.phone.replace(/\D/g, "")}">${U.esc(lib.phone)}</a>${lib.url ? " · " + ext(lib.url, "Hours") : ""}` : ""),
      wifi && (!lib || wifi.d < lib.d) ? pl(wifi, "wifi", "#1d6fb8", `Free public Wi-Fi${wifi.where ? " at a " + U.esc(wifi.where) + " site" : ""}`) : "",
      pl(drop, "recycle", "#3f7f8c", "Trash and recycling drop-off, free for residents", ext("https://www.baltimorecity.gov/publicworks/trash-recycling", "What they take")),
      pl(gard, "sprout", "#5e9e2f", [gard?.kind, gard?.plots ? "garden plots" : "", gard?.volunteers ? "takes volunteers" : "", gard?.compost ? "takes compost" : ""].filter(Boolean).map(U.esc).join(", "), gard?.url ? ext(gard.url, "Website") : ""),
      pl(sen, "users", "var(--s3)", "Senior center: meals, activities and a cooling or warming spot", sen?.phone ? `<a href="tel:${sen.phone.replace(/\D/g, "")}">${U.esc(sen.phone)}</a>` : ""),
    ].join("");
    el.innerHTML = `<div class="place-list stagger">${rows.join("")}</div>
      <div class="section-h"><h3>Useful places nearby</h3></div><div class="place-list">${places}</div>
      ${bge()}${tree()}`;
    FX?.watch?.(el);
  }
  const bge = () => `<div class="place-list" style="margin-top:12px"><div class="place">${tile("bolt", "var(--accent)")}<div><b>Power out?</b><small>Report it to BGE at 1-877-778-2222 or check the outage map. Smell gas? Leave first, then call 1-800-685-0123.</small><small>${ext("https://www.bge.com/outages/outage-map", "BGE outage map")}</small></div><div class="go"><a class="round call" href="tel:18777782222" aria-label="Call BGE outages" title="Call BGE">${I("phone", 20)}</a></div></div></div>`;
  const tree = () => `<div class="place-list" style="margin-top:12px"><div class="place">${tile("tree", "var(--s0)")}<div><b>Get a free tree</b><small>TreeBaltimore gives away free yard trees every spring and fall. For a street tree in front of your home, send the city's street tree request form to the Forestry Division.</small><small>${ext("https://www.treebaltimore.org/treeevents", "Tree giveaway dates")} · ${ext("https://www.baltimorecity.gov/bcrp/treebaltimore", "Street tree request form")}</small></div></div></div>`;

  // ---------- map layers ----------
  const DEF = {
    snowroutes: { label: "Snow emergency routes", icon: "car", color: "#d6283b" },
    trashzones: { label: "Trash and recycling days", icon: "trash", color: "#5a6b78" },
    sweepzones: { label: "Alley sweeping areas", icon: "broom", color: "#3f7f8c" },
    council:    { label: "City Council districts", icon: "users", color: "#6b4c9a" },
    libraries:  { label: "Libraries", icon: "book", color: "#8a5a2b" },
    wifi:       { label: "Free Wi-Fi", icon: "wifi", color: "#1d6fb8" },
    citygardens:{ label: "Gardens and urban farms", icon: "sprout", color: "#5e9e2f" },
    dropoff:    { label: "Drop-off centers", icon: "recycle", color: "#3f7f8c" },
    seniors:    { label: "Senior centers", icon: "users", color: "#c77700" },
    codeblue:   { label: "Code Blue shelters", icon: "bed", color: "#1d4f91" },
  };
  const DAYC = { Monday: "#1d6fb8", Tuesday: "#24804f", Wednesday: "#b98500", Thursday: "#6b4c9a", Friday: "#d26a1c" };
  async function layer(key, mk) {
    if (key === "snowroutes") { const g = await geo("snow");
      return L.geoJSON(g, { style: { color: "#d6283b", weight: 3, opacity: .8 }, onEachFeature: (f, l) => l.bindPopup(`<h4>${U.esc(f.properties.street)}</h4>Snow emergency route. No parking when a snow emergency is declared ($52 ticket, towing).`) }); }
    if (key === "trashzones") { const g = await geo("trash");
      return L.geoJSON(g, { style: f => ({ color: "#fff", weight: 1, fillColor: DAYC[f.properties.trash] || "#5a6b78", fillOpacity: .32 }), onEachFeature: (f, l) => l.bindPopup(`<h4>Trash: ${U.esc(f.properties.trash)}</h4>Recycling: ${U.esc(f.properties.recycling)}<br><small>Baltimore Public Works</small>`) }); }
    if (key === "sweepzones") { const g = await geo("sweep"); g.features = g.features.filter(f => f.properties.kind === "alley");
      return L.geoJSON(g, { style: { color: "#3f7f8c", weight: 1.5, fillOpacity: .22 }, onEachFeature: (f, l) => l.bindPopup(`<h4>${U.esc(f.properties.name)}</h4>Alley sweeping: ${U.esc(f.properties.note)}`) }); }
    if (key === "council") { const g = await geo("council");
      return L.geoJSON(g, { style: { color: "#6b4c9a", weight: 2, fillOpacity: .05 }, onEachFeature: (f, l) => { const p = f.properties; l.bindTooltip(`District ${p.district}`, { permanent: false, sticky: true }); l.bindPopup(`<h4>District ${p.district}: ${U.esc(p.member || "")}</h4>${p.phone ? U.esc(p.phone) + "<br>" : ""}${p.email ? `<a href="mailto:${U.esc(p.email)}">${U.esc(p.email)}</a>` : ""}`); } }); }
    const S = await svc(), d = DEF[key];
    const list = key === "citygardens" ? S.gardens : S[key] || [];
    return L.layerGroup(list.map(x => { const o = key === "codeblue" ? openNow(x.hours) : null;
      return mk(x.lat, x.lon, d).bindPopup(`<h4>${U.esc(x.name)}</h4>${x.address ? U.esc(x.address) + "<br>" : ""}${x.hours ? `<small>${U.esc(x.hours)}</small><br>` : ""}${o ? `<small><b>${U.esc(o.text)}</b></small><br>` : ""}${x.phone ? `<small>${U.esc(x.phone)}</small><br>` : ""}${x.capacity ? `<small>${U.esc(x.capacity)}</small><br>` : ""}<a href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}" target="_blank" rel="noopener">Directions</a>`); }));
  }

  /** Code Blue shelters with posted hours, for Get help */
  async function shelters(el, lat, lon) {
    if (!el) return; const S = await svc().catch(() => null); if (!S?.codeblue?.length) { el.innerHTML = ""; return; }
    const list = nearest(S.codeblue, lat, lon, 6);
    el.innerHTML = list.map(x => `<div class="place">${tile("bed", "#1d4f91")}<div><b>${U.esc(x.name)}</b><small>${U.esc(x.address || "")}${x.hours ? " · " + U.esc(x.hours) : ""}</small>${openBadge(openNow(x.hours))}${x.capacity ? `<small>${U.esc(x.capacity)}</small>` : ""}${x.phone ? `<small><a href="tel:${x.phone.replace(/\D/g, "")}">${U.esc(x.phone)}</a></small>` : ""}</div><div class="go"><span class="tnum">${U.dist(x.d)}</span>${dirBtn(x.lat, x.lon, x.name)}</div></div>`).join("") +
      `<p class="note">Shelter list from the city's Code Blue map. Beds fill up: call the Shelter Hotline at 443-984-9540 first.</p>`;
  }

  return { at, section, next, openNow, openBadge, parseHours, DEF, layer, shelters };
})();
