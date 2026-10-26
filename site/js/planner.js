/* Day planner: scores every hour of the next 48 from the live forecast for a chosen activity,
   finds the best window, flags times to avoid, and suggests nearby places. */
const PLAN = (() => {
  const D = () => APP.data;
  const ACTS = {
    walk:   { for: "a walk", label: "Walk", icon: "🚶", hrs: 1, ideal: [48, 80], w: { rain: 1, aqi: 1, uv: .5, wind: .3, dark: 1 }, go: ["parks.geojson"], goLabel: "Parks nearby" },
    run:    { for: "a run", label: "Run", icon: "🏃", hrs: 1, ideal: [45, 66], w: { rain: .9, aqi: 1.6, uv: .6, wind: .4, dark: .5, heat: 1.4 }, go: ["parks.geojson", "osm_fountains.geojson"], goLabel: "Parks and water fountains" },
    bike:   { for: "a bike ride", label: "Bike ride", icon: "🚲", hrs: 2, ideal: [55, 80], w: { rain: 1.3, aqi: 1.1, uv: .5, wind: 1.3, dark: 1 }, go: ["osm_bike.geojson"], goLabel: "Nearest bike lanes and trails" },
    kids:   { for: "kids to play outside", label: "Kids outside", icon: "🛝", hrs: 2, ideal: [60, 82], w: { rain: 1.1, aqi: 1.4, uv: 1.2, wind: .4, dark: 1.6, heat: 1.2 }, go: ["rec_centers.geojson", "parks.geojson", "pools.geojson"], goLabel: "Rec centers, parks and pools" },
    work:   { for: "yard or outdoor work", label: "Yard or outdoor work", icon: "🧹", hrs: 3, ideal: [50, 75], w: { rain: 1, aqi: 1.1, uv: .9, wind: .5, dark: 1.2, heat: 1.5 }, go: [], goLabel: "" },
    picnic: { for: "a picnic or market trip", label: "Picnic or market", icon: "🧺", hrs: 3, ideal: [62, 85], w: { rain: 1.5, aqi: .9, uv: .7, wind: .7, dark: 1.6 }, go: ["osm_markets.geojson", "parks.geojson"], goLabel: "Markets and parks" },
    garden: { for: "gardening", label: "Gardening", icon: "🌱", hrs: 2, ideal: [50, 82], w: { rain: .9, aqi: .9, uv: .9, wind: .5, dark: 1.4 }, go: ["osm_gardens.geojson"], goLabel: "Community gardens" },
  };
  let act = U.store.get("planAct", "walk");

  function scoreHours(W, AQ, a) {
    const H = W.hourly, now = Date.now(); let i0 = H.time.findIndex(t => new Date(t).getTime() > now) - 1; if (i0 < 0) i0 = 0;
    const out = [];
    for (let k = i0; k < Math.min(H.time.length, i0 + 48); k++) {
      const T = H.temperature_2m[k], RH = H.relative_humidity_2m[k], V = H.wind_speed_10m[k];
      const feel = T >= 80 ? U.heatIndex(T, RH) : T <= 50 ? U.windChill(T, V) : T;
      const ai = AQ ? AQ.hourly.time.indexOf(H.time[k]) : -1, aqi = ai >= 0 ? AQ.hourly.us_aqi[ai] : null;
      const rain = H.precipitation_probability[k] ?? 0, uv = H.uv_index[k] ?? 0, day = !!H.is_day[k], hr = new Date(H.time[k]).getHours();
      let s = 100; const why = [];
      const [lo, hi] = a.ideal;
      if (feel < lo) { const p = (lo - feel) * 1.7; s -= p; if (feel < lo - 12) why.push(`cold (${U.tF(feel)})`); }
      if (feel > hi) { const p = (feel - hi) * 2.6 * (a.w.heat || 1); s -= p; if (feel > hi + 6) why.push(`hot (${U.tF(feel)})`); }
      if (rain > 10) { const p = rain * .75 * a.w.rain; s -= p; if (rain >= 45) why.push(`${rain}% rain chance`); }
      if (aqi != null && aqi > 50) { const p = (aqi - 50) * .7 * a.w.aqi; s -= p; if (aqi > 100) why.push(`unhealthy air (AQI ${Math.round(aqi)})`); }
      if (uv > 5) { const p = (uv - 5) * 6 * a.w.uv; s -= p; if (uv >= 8) why.push(`very strong sun (UV ${Math.round(uv)})`); }
      if (V > 15) { const p = (V - 15) * 2.5 * a.w.wind; s -= p; if (V >= 22) why.push(`windy (${Math.round(V)} mph)`); }
      if (!day) { s -= 40 * a.w.dark; why.push("dark"); }
      if (hr >= 22 || hr < 6) s -= 25;
      if ((T >= 80 && feel >= 103) || (T <= 50 && feel <= 13)) s = Math.min(s, 8);
      if (aqi != null && aqi > 150) s = Math.min(s, 12);
      out.push({ k, t: new Date(H.time[k]), s: Math.max(0, Math.min(100, Math.round(s))), feel, rain, aqi, uv, V, day, code: H.weather_code[k], why });
    }
    return out;
  }
  function bestWindow(hs, L) {
    let best = null;
    for (let i = 0; i + L <= hs.length; i++) {
      if (i === 0 && hs.length > 1 && new Date() - hs[0].t > 40 * 60000) continue; // skip a mostly-past hour
      const avg = hs.slice(i, i + L).reduce((a, h) => a + h.s, 0) / L;
      if (!best || avg > best.avg + .5) best = { i, avg };
    }
    return best;
  }
  const dayName = d => { const t = new Date(); t.setHours(0, 0, 0, 0); const x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((x - t) / 864e5); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "long" }); };
  const hm = d => d.toLocaleTimeString([], { hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined });
  const color = s => s >= 75 ? "#34c759" : s >= 55 ? "#f2b705" : s >= 35 ? "#ff9500" : "#ff3b30";
  const word = s => s >= 80 ? "Great time" : s >= 65 ? "Good time" : s >= 50 ? "OK time" : "Best you'll get";

  function ics(a, start, end) {
    const f = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + "0000";
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Charm City Pulse//Planner//EN", "BEGIN:VEVENT", `UID:${Date.now()}@charmcitypulse`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:${a.icon} ${a.label} (best time from Charm City Pulse)`, "DESCRIPTION:Picked from the live Baltimore forecast for heat\\, rain\\, air and sun.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }

  async function where(a) {
    const box = U.$("#planWhere");
    const loc = U.store.get("loc", null), here = loc ? [loc.lon, loc.lat] : [LIVE.CENTER[1], LIVE.CENTER[0]];
    if (!a.go.length) {
      const W = LIVE.feeds.weather.value, hot = W && Math.max(...W.daily.temperature_2m_max.slice(0, 2)) >= 88;
      box.innerHTML = `<div class="place"><span class="pi" style="background:var(--tint)">💧</span><div><b>${hot ? "Take breaks in the shade and drink water every 20 minutes" : "Dress for the weather and take breaks"}</b><small class="muted">${hot ? "Heavy work in heat is the most common cause of heat illness." : "Check the hour-by-hour bars above to plan breaks."}</small></div><span></span></div>`; return;
    }
    const near = [];
    for (const f of a.go) {
      try {
        const gj = await U.getJSON("data/" + f);
        gj.features.forEach(ft => {
          const g = ft.geometry; let c = g.type === "Point" ? g.coordinates : g.type === "LineString" ? g.coordinates[Math.floor(g.coordinates.length / 2)] : (g.type === "Polygon" ? g.coordinates[0][0] : g.coordinates[0][0][0]);
          if (!c) return; near.push({ name: ft.properties.name || (f.includes("bike") ? "Bike lane" : f.includes("fountain") ? "Drinking fountain" : f.includes("garden") ? "Community garden" : f.includes("market") ? "Market" : "Park"), addr: ft.properties.address || "", lat: c[1], lon: c[0], d: U.km(here, c), kind: f });
        });
      } catch {}
    }
    const seen = new Set(); const top = near.sort((x, y) => x.d - y.d).filter(x => { const k = x.name + Math.round(x.d * 10); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
    const ic = k => k.includes("fountain") ? "🚰" : k.includes("bike") ? "🚲" : k.includes("pool") ? "🏊" : k.includes("rec") ? "🏀" : k.includes("market") ? "🧺" : k.includes("garden") ? "🥕" : "🌳";
    box.innerHTML = `<p class="note" style="margin:0 0 4px">${U.esc(a.goLabel)} closest to ${U.esc(loc?.label?.split(",")[0] || "downtown")}${loc ? "" : ` · <a href="#place">add your address</a>`}</p>` +
      top.map(x => `<div class="place"><span class="pi" style="background:var(--tint)">${ic(x.kind)}</span><div><b>${U.esc(x.name)}</b><small class="muted">${x.addr ? U.esc(x.addr) + " · " : ""}${U.dist(x.d)} away</small></div>
        <div class="go"><a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(x.name)}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.7 11.3 12.7 2.3a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg></a></div></div>`).join("");
  }

  function render() {
    const W = LIVE.feeds.weather.value, AQ = LIVE.feeds.air.value, a = ACTS[act];
    U.$$("#planActs .plan-act").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.a === act)));
    if (!W) { U.$("#planBest").innerHTML = `<div class="best"><div class="when">Loading the forecast…</div></div>`; return; }
    const hs = scoreHours(W, AQ, a), b = bestWindow(hs, a.hrs);
    if (!b) return;
    const s = hs[b.i], e = new Date(hs[b.i + a.hrs - 1].t.getTime() + 3600e3), slice = hs.slice(b.i, b.i + a.hrs);
    const avgFeel = slice.reduce((x, h) => x + h.feel, 0) / slice.length, maxRain = Math.max(...slice.map(h => h.rain)), aq = slice.map(h => h.aqi).filter(x => x != null), maxUV = Math.max(...slice.map(h => h.uv));
    const tags = [`${FX.icon(s.code, s.day ? 1 : 0, 18)} ${U.tF(avgFeel)}`, maxRain < 20 ? "Dry" : `${maxRain}% rain chance`, aq.length ? `Air ${LIVE.aqiCat(Math.max(...aq)).t.toLowerCase()}` : null, maxUV >= 6 ? `Strong sun, UV ${Math.round(maxUV)}` : null].filter(Boolean);
    U.$("#planBest").innerHTML = `<div class="best stagger"><div style="opacity:.85">${a.icon} ${word(b.avg)} for ${a.for}</div>
      <div class="when">${dayName(s.t)}, ${hm(s.t)} – ${hm(e)}</div>
      <div class="tags">${tags.map(t => `<span>${t}</span>`).join("")}</div>
      <div class="cta"><button class="btn" id="planCal">Add to calendar</button>${navigator.share ? `<button class="btn alt" id="planShare">Share</button>` : ""}</div></div>`;
    U.$("#planCal").onclick = () => { U.download(`${act}-${s.t.toISOString().slice(0, 10)}.ics`, ics(a, s.t, e), "text/calendar"); U.toast("Calendar file downloaded. Open it to add the event."); };
    const sh = U.$("#planShare"); if (sh) sh.onclick = () => navigator.share({ title: "Charm City Pulse", text: `${a.icon} Best time for ${a.for} in Baltimore: ${dayName(s.t)} ${hm(s.t)}–${hm(e)}`, url: location.href }).catch(() => {});
    // timeline
    const tl = U.$("#planTL");
    tl.innerHTML = hs.map((h, j) => `<div class="slot${j >= b.i && j < b.i + a.hrs ? " best-slot" : ""}" style="background:${color(h.s)}" data-h="${Math.max(6, h.s)}" title="${dayName(h.t)} ${hm(h.t)}: ${h.s >= 75 ? "great" : h.s >= 55 ? "OK" : h.s >= 35 ? "not ideal" : "avoid"}${h.why.length ? " – " + h.why.join(", ") : ""}"></div>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => U.$$("#planTL .slot").forEach((el, j) => setTimeout(() => el.style.height = el.dataset.h + "%", FX.reduce ? 0 : j * 12))));
    const lab = j => j < hs.length ? (j === 0 ? "Now" : `${dayName(hs[j].t) === "Today" ? "Today" : hs[j].t.toLocaleDateString([], { weekday: "short" })} ${hm(hs[j].t)}`) : "";
    U.$("#planAxis").innerHTML = [0, 12, 24, 36, 47].map(j => `<span>${lab(j)}</span>`).join("");
    U.$("#planRange").textContent = "Next 48 hours";
    // avoid windows (daylight hours with low scores)
    const bad = []; let cur = null;
    hs.forEach((h, j) => { const isBad = h.day && h.s < 35 && h.why.some(w => w !== "dark"); if (isBad) { if (!cur) cur = { a: j, b: j, why: new Set() }; cur.b = j; h.why.filter(w => w !== "dark").forEach(w => cur.why.add(w.replace(/\s*\(.*\)/, ""))); } else if (cur) { bad.push(cur); cur = null; } });
    if (cur) bad.push(cur);
    U.$("#planAvoid").innerHTML = bad.slice(0, 2).map(x => `<div class="avoid" style="margin-bottom:8px"><span style="font-size:1.2rem">⚠️</span><div><b>Avoid ${dayName(hs[x.a].t).toLowerCase() === "today" ? "today" : dayName(hs[x.a].t)} ${hm(hs[x.a].t)} – ${hm(new Date(hs[x.b].t.getTime() + 3600e3))}</b><br><span class="muted">${[...x.why].slice(0, 3).join(", ")}</span></div></div>`).join("");
    where(a);
  }
  let wired = false;
  function show() {
    U.$("#planActs").innerHTML = Object.entries(ACTS).map(([k, a]) => `<button class="plan-act" data-a="${k}" aria-pressed="${k === act}"><span>${a.icon}</span>${a.label}</button>`).join("");
    U.$$("#planActs .plan-act").forEach(b => b.onclick = () => { act = b.dataset.a; U.store.set("planAct", act); render(); if (navigator.vibrate) navigator.vibrate(8); });
    if (!wired) { wired = true; LIVE.feeds.weather.on(() => APP.view === "plan" && render()); LIVE.feeds.air.on(() => APP.view === "plan" && render()); }
    render();
  }
  return { views: { plan: { show, unit: render } } };
})();
