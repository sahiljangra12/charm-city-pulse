/* Resident mode — plain language, quick actions, no jargon.
   Today · My block · Map · Help. Everything technical lives in researcher mode (conditions.js / research.js). */
const RES = (() => {
  const ICON_PHONE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>', ICON_DIR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.7 11.3 12.7 2.3a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>', ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const dirBtn = (lat, lon, name) => `<a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(name)}" title="Directions">${ICON_DIR}</a>`;
  const D = () => APP.data;
  const F = id => LIVE.feeds[id];
  let userLoc = U.store.get("loc", null);
  const short = n => String(n || "").replace(/,?\s*MD\.?$/i, "").replace(/\s+AT BALTIMORE$/i, "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(At|Near|Nr|Of|To)\b/g, w => w.toLowerCase()).replace(/\bBlvd\b/, "Blvd.").replace(/\bAve\b/, "Ave.");
  function aqiNow() {
    const m = (F("airnow").value || []).find(x => x.km < 25), AQ = F("air").value;
    return m ? { aqi: m.aqi, site: m.name, km: m.km, time: m.time, mon: m } : { aqi: AQ?.current.us_aqi ?? null, site: null };
  }
  const curHour = h => { const now = Date.now(); let i = h.time.findIndex(t => new Date(t).getTime() > now); return Math.max(0, (i < 0 ? h.time.length : i) - 1); };
  const hourLabel = t => new Date(t).toLocaleTimeString([], { hour: "numeric" });

  // ---------- plain-language wording ----------
  const THEMES = {
    heat:     { title: "Summer heat", icon: "🔥", words: ["Among the coolest areas", "Cooler than most of the city", "About average for Baltimore", "Hotter than most of the city", "Among the hottest areas"] },
    trees:    { title: "Shade from trees", icon: "🌳", words: ["Lots of tree shade", "More shade than most", "About average shade", "Less shade than most", "Very little tree shade"] },
    health:   { title: "Health risks", icon: "❤️", words: ["Among the lowest in the city", "Lower than most", "About average", "Higher than most", "Among the highest in the city"] },
    social:   { title: "Money and jobs", icon: "💼", words: ["Among the least strained", "Less strained than most", "About average", "More strained than most", "Among the most strained"] },
    energy:   { title: "Housing and energy bills", icon: "🏠", words: ["Among the least strained", "Less strained than most", "About average", "More strained than most", "Among the most strained"] },
    mobility: { title: "Getting around and food", icon: "🚌", words: ["Among the easiest", "Easier than most", "About average", "Harder than most", "Among the hardest"] },
  };
  const level = v => v == null ? -1 : v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0;
  const LEVEL_C = ["var(--good)", "#5aa47a", "var(--fair)", "var(--poor)", "var(--bad)"];
  const ACTIONS = {
    heat: ["🧊", "Have a plan for hot days", "Know your nearest cooling center, keep blinds closed by day, and check on older neighbors. Call 311 on Code Red days."],
    trees: ["🌳", "Get a free street tree", "TreeBaltimore plants trees for free. Young trees noticeably cool a block within about ten years.", "https://www.treebaltimore.org"],
    health: ["💨", "Check the air before you exercise", "On bad-air days, people with asthma or heart problems should keep outdoor activity light."],
    social: ["📞", "Call 2-1-1 for help with food, rent or bills", "211 Maryland is free, open 24/7 and connects you to local programs.", "tel:211"],
    energy: ["💡", "Get help with energy bills", "Maryland's energy assistance program helps with electric and gas bills and past-due balances.", "https://dhs.maryland.gov/office-of-home-energy-programs/"],
    mobility: ["🚌", "Plan trips by bus, rail or the free Circulator", "Maryland Transit trip planner and the Charm City Circulator.", "https://www.mta.maryland.gov"],
  };
  function feelsWord(T, RH, V) {
    const fc = LIVE.feelsCat(T, RH, V);
    if (!fc) return { fc: null, tip: "" };
    if (fc.kind === "heat") return { fc, tip: ["Comfortable.", "Warm. Drink water.", "Hot. Rest in shade and drink water often.", "Dangerously hot. Stay somewhere cool.", "Extreme heat. Stay indoors somewhere cool."][fc.lvl] };
    if (fc.kind === "cold") return { fc, tip: ["Cool. A light jacket helps.", "Cold. Wear a warm coat.", "Freezing. Cover up, and warming centers may open.", "Dangerous cold. Limit time outside."][fc.lvl] };
    return { fc, tip: "Comfortable." };
  }

  // ======================= TODAY =======================
  function drawHome() {
    const W = F("weather").value, AQ = F("air").value, AL = F("alerts").value || [];
    U.$("#hWhen").innerHTML = `<span class="livedot"></span> Baltimore, ${new Date().toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}`;
    if (!W && !AQ) { if (F("weather").err) { U.$("#hAnswer").textContent = "Reconnecting to the weather service…"; U.$("#hWhy").textContent = "This page tries again automatically."; } return; }
    const c = W?.current, now = aqiNow(), ac = LIVE.aqiCat(now.aqi);
    const fw = c ? feelsWord(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m) : { fc: null };
    const i0 = W ? curHour(W.hourly) : 0;
    const rainNext = W ? W.hourly.precipitation_probability.slice(i0, i0 + 12) : [];
    const rainMax = rainNext.length ? Math.max(...rainNext.map(x => x ?? 0)) : 0, rainAt = rainNext.findIndex(x => x >= 50);
    const severe = AL.some(x => /Extreme|Severe/.test(x.severity));
    const lvl = Math.max(fw.fc?.lvl || 0, Math.min(4, ac.lvl), severe ? 3 : 0);
    const answers = ["A good day to be outside", "Fine outside, with a little care", "Take it easy outside today", "Limit your time outside", "Stay inside if you can"];
    let ans = answers[Math.min(lvl, 4)];
    if (lvl === 0 && rainMax >= 60) ans = "Fine outside, but bring an umbrella";
    U.$("#hAnswer").textContent = ans;
    const why = [];
    if (fw.fc && fw.fc.lvl > 0) why.push(fw.tip);
    if (ac.lvl > 0) why.push(`The air is ${ac.t.toLowerCase()}${ac.lvl === 1 ? ", fine for most people" : ""}.`);
    if (AL.length) why.push(`${AL[0].event} in effect.`);
    if (!why.length) why.push(`${c ? LIVE.WMO[c.weather_code] || "Calm" : "Calm"}, clean air${rainMax < 30 ? " and no rain expected" : ""}.`);
    U.$("#hWhy").textContent = why.join(" ");
    if (c) {
      const kind = LIVE.sky(c.weather_code), day = !!c.is_day, hot = fw.fc?.kind === "heat" && fw.fc.lvl >= 2, cold = fw.fc?.kind === "cold" && fw.fc.lvl >= 2;
      const cls = `sky ${day ? "day" : "night"} ${kind}${hot ? " hot" : ""}${cold ? " cold" : ""}`;
      const sky = U.$("#hSky"); if (sky.className !== cls) { sky.className = cls; U.$("#hScene").innerHTML = FX.scene(kind, day, hot); }
      U.$("#hTemp").innerHTML = `<span id="hTempN">${U.tF(c.temperature_2m)}</span><small>Feels like ${U.tF(fw.fc ? fw.fc.index : c.apparent_temperature)}</small>`;
    }
    // alerts
    U.$("#hAlert").innerHTML = AL.length ? `<div class="alertbar" role="alert"><span style="font-size:1.4rem">⚠️</span><div><b>${U.esc(AL[0].event)}</b><br>${U.esc(AL[0].headline || "")}${AL[0].instruction ? `<details><summary>What to do</summary><p>${U.esc(AL[0].instruction)}</p></details>` : ""}${AL.length > 1 ? `<br><small>+ ${AL.length - 1} more alert${AL.length > 2 ? "s" : ""}</small>` : ""}</div></div>` : "";
    // three facts
    const airTip = ac.lvl === 0 ? "Clean air. Fine for everyone." : ac.lvl === 1 ? "Fine for most people. Very sensitive people may want to take it easy." : ac.lvl === 2 ? "People with asthma, heart or lung problems, kids and older adults should limit hard activity." : "Everyone should cut back on hard activity outside.";
    const rainTip = !W ? "" : rainMax < 20 ? "No rain expected in the next 12 hours." : rainAt >= 0 ? `Likely around ${hourLabel(W.hourly.time[i0 + rainAt])}. Bring an umbrella.` : `Small chance (${rainMax}%) in the next 12 hours.`;
    U.$("#hFacts").innerHTML = `
      <div class="fact"><div class="ico" style="background:color-mix(in srgb,${ac.c} 18%,transparent)">💨</div><b>Air: ${now.aqi == null ? "—" : ac.t}</b><span>${airTip}${now.aqi != null ? ` <span class="muted">(AQI ${Math.round(now.aqi)})</span>` : ""}</span></div>
      <div class="fact"><div class="ico" style="background:color-mix(in srgb,${fw.fc ? fw.fc.c : "#888"} 18%,transparent)">🌡️</div><b>${c ? `${U.tF(c.temperature_2m)} now` : "Temperature"}</b><span>${c ? `Today ${U.tF(W.daily.temperature_2m_min[0])} to ${U.tF(W.daily.temperature_2m_max[0])}. ${fw.tip}` : ""}</span></div>
      <div class="fact"><div class="ico" style="background:color-mix(in srgb,var(--harbor-2) 16%,transparent)">${rainMax >= 50 ? "☔" : "🌤️"}</div><b>${rainMax >= 50 ? "Rain likely" : rainMax >= 20 ? "Maybe some rain" : "Staying dry"}</b><span>${rainTip}</span></div>`;
    // hours & week
    if (W) {
      const H = W.hourly;
      U.$("#hHours").innerHTML = Array.from({ length: Math.min(12, H.time.length - i0) }, (_, k) => i0 + k).map((k, j) =>
        `<div class="hour"><span>${j === 0 ? "Now" : hourLabel(H.time[k])}</span><div>${FX.icon(H.weather_code[k], H.is_day[k], 30)}</div><b>${U.tF(H.temperature_2m[k])}</b><div class="rain">${(H.precipitation_probability[k] ?? 0) >= 20 ? "💧" + H.precipitation_probability[k] + "%" : ""}</div></div>`).join("");
      const d = W.daily, lo = Math.min(...d.temperature_2m_min), hi = Math.max(...d.temperature_2m_max);
      U.$("#hWeek").innerHTML = d.time.map((t, k) => { const a = (d.temperature_2m_min[k] - lo) / (hi - lo || 1) * 100, b = (d.temperature_2m_max[k] - lo) / (hi - lo || 1) * 100;
        return `<div class="day"><b>${k === 0 ? "Today" : new Date(t + "T12:00").toLocaleDateString([], { weekday: "short" })}</b>${FX.icon(d.weather_code[k], 1, 26)}<span class="muted" style="text-align:right">${U.tF(d.temperature_2m_min[k])}</span><div class="range"><i style="left:${a}%;width:${Math.max(4, b - a)}%"></i></div><span>${U.tF(d.temperature_2m_max[k])}</span>${(d.precipitation_probability_max[k] ?? 0) >= 30 ? `<span class="rain">💧 ${d.precipitation_probability_max[k]}% chance of rain</span>` : ""}</div>`; }).join("");
    }
  }
  function drawMyArea() {
    const box = U.$("#hMyArea"); const id = userLoc && APP.tractAt(userLoc.lat, userLoc.lon);
    if (!id) { box.innerHTML = `<div class="myarea"><div><b style="font-size:1.05rem">See how your block compares</b><br><span class="muted">Add your address once to see its summer heat, flood risk and nearest help right here.</span></div><a class="btn" href="#place">Add my address</a></div>`; return; }
    const p = D().byId[id].properties;
    const tags = p.nonres ? [] : ["heat", "trees"].map(k => { const l = level(p["t_" + k]); return l < 0 ? "" : `<span class="pill"><span class="dot" style="background:${LEVEL_C[l]}"></span>${THEMES[k].words[l]}</span>`; });
    box.innerHTML = `<div class="myarea"><div><span class="muted" style="font-size:.9rem">Your block · ${U.esc(userLoc.label || "")}</span><br><b style="font-size:1.2rem;font-family:var(--display)">${U.esc(p.csa)}</b><div class="tags">${tags.join("")}<span class="pill" id="myFlood">🌊 checking flood risk…</span></div></div><a class="btn alt" href="#place/${id}">Full report</a></div>`;
    LIVE.floodAt(userLoc.lat, userLoc.lon).then(r => { const el = U.$("#myFlood"); if (el) el.innerHTML = `<span class="dot" style="background:${["var(--good)", "var(--fair)", "var(--bad)", "var(--severe)"][r.level]}"></span>${floodWords(r).short}`; }).catch(() => { const el = U.$("#myFlood"); if (el) el.remove(); });
  }
  function drawActions() {
    const s = LIVE.season();
    const place = s === "winter" ? ["🔥", "Find a warm place", "Warming centers and shelters near you"] : s === "summer" ? ["🧊", "Find a cool place", "Cooling centers near you on hot days"] : ["🏠", "Cool or warm places", "Warming centers open from Nov 15"];
    const A = [
      ["#place", "📍", "Check my block", "Heat, flood risk and help nearby", "primary"],
      ["#help", ...place],
      ["#map", "🗺️", "Find places on a map", "Parks, pools, water fountains, bike lanes, markets"],
      ["#place", "🌊", "Am I in a flood zone?", "FEMA flood risk for any address"],
      ["#help", "📞", "Call for help", "311, 211, shelter and energy-bill lines"],
      ["https://www.treebaltimore.org", "🌳", "Get a free street tree", "TreeBaltimore plants and waters it"],
    ];
    U.$("#hActions").classList.add("stagger"); U.$("#hActions").innerHTML = A.map(([h, i, t, d, cls]) => `<a class="action ${cls || ""}" href="${h}"${h.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><span class="ai">${i}</span><b>${t}</b><span>${d}</span></a>`).join("");
  }
  let homeWired = false;
  function homeShow() {
    drawActions(); drawMyArea();
    if (homeWired) { drawHome(); return; } homeWired = true;
    F("weather").on(drawHome); F("air").on(drawHome); F("airnow").on(drawHome); F("alerts").on(drawHome);
    setInterval(() => { if (APP.view === "today") drawHome(); }, 60000);
  }

  // ======================= MY BLOCK =======================
  let pending = null;
  function pick(lat, lon, label, err) {
    if (err) return msg(err);
    const id = APP.tractAt(lat, lon);
    if (!id) return msg("That spot is outside Baltimore City. This app covers Baltimore City only.");
    userLoc = { lat, lon, label: label || "Spot on the map" }; U.store.set("loc", userLoc); pending = userLoc;
    if (location.hash === "#place/" + id) placeShow([id]); else location.hash = "place/" + id;
  }
  function msg(t) { if (!location.hash.startsWith("#place")) location.hash = "place"; setTimeout(() => { const m = U.$("#pMsg"); m.textContent = t; m.style.color = "var(--bad)"; }, 60); }
  const floodWords = r => r.level >= 2 ? { short: "High flood risk", long: "This spot is in FEMA's high-risk flood zone (zone " + r.zone + "). Flood insurance is usually required with a mortgage, and it's worth having either way.", icon: "🌊", c: "var(--bad)" }
    : r.level === 1 ? { short: "Some flood risk", long: "This spot is in FEMA's moderate-risk area (the \"500-year\" floodplain). Heavy rain can still flood streets and basements.", icon: "🌧️", c: "var(--fair)" }
    : { short: "Low flood risk", long: "This spot is outside FEMA's flood zones. Heavy rain can still flood streets and basements.", icon: "✅", c: "var(--good)" };
  function centersNear(lat, lon) {
    const s = LIVE.season(), C = D().centers, here = [lon, lat];
    const cool = C.cooling.map(x => ({ ...x, kind: "cool" })), warm = C.winter.sites.filter(x => x.lat != null && x.type === "Warming center").map(x => ({ ...x, kind: "warm" }));
    const near = l => l.map(x => ({ ...x, d: U.km(here, [x.lon, x.lat]) })).sort((a, b) => a.d - b.d);
    const key = a => (a || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 2).join(" ");
    const w = near(warm), wk = new Set(w.map(x => key(x.address))), c = near(cool).filter(x => !wk.has(key(x.address)));
    return s === "winter" ? w.slice(0, 3) : s === "summer" ? near(cool).slice(0, 3) : [...w.slice(0, 2), ...c.slice(0, 2)];
  }
  const placeCard = x => `<div class="place"><span class="pi" style="background:${x.kind === "warm" ? "color-mix(in srgb,var(--poor) 18%,transparent)" : "color-mix(in srgb,var(--harbor-2) 16%,transparent)"}">${x.kind === "warm" ? "🔥" : "🧊"}</span>
    <div><b>${U.esc(x.name)}</b><small class="muted">${U.esc(x.address.replace(/, Baltimore, MD \d+/, ""))}${x.hours ? " · " + U.esc(x.hours) : ""}</small><small class="muted">${x.kind === "warm" ? "Warming center, open on cold days Nov 15 – Mar 15" : "Cooling center, open on Code Red heat days"}${x.serves && x.serves !== "All" ? " · " + U.esc(x.serves) : ""}</small></div>
    <div class="go"><span class="muted">${U.dist(x.d)}</span>${dirBtn(x.lat, x.lon, x.name)}</div></div>`;
  let pMap, pLayer, pMarker;
  function placeInit() {
    APP.searchForm(U.$("#v-place form[data-geo]"), pick);
    pMap = APP.makeMap("pMap", { zoom: 12, scroll: false });
    pLayer = L.geoJSON(D().tracts, { style: f => f.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .6, fillOpacity: .04, fillColor: "#999" } }).addTo(pMap);
    pMap.on("click", e => pick(e.latlng.lat, e.latlng.lng, "Spot on the map"));
  }
  function placeShow([id]) {
    const body = U.$("#pBody"), m = U.$("#pMsg"); m.style.color = "";
    if (!id && userLoc) id = APP.tractAt(userLoc.lat, userLoc.lon);
    if (!id || !D().byId[id]) {
      m.textContent = "";
      body.innerHTML = `<div class="myarea" style="margin-top:6px"><div><b>No address yet</b><br><span class="muted">Search above, tap the map below, or let your phone find you.</span></div><button class="btn" id="pLocate">📍 Use my location</button></div>`;
      U.$("#pLocate").onclick = () => U.$("#v-place [data-locate]").click(); return;
    }
    const f = D().byId[id], p = f.properties;
    const pt = pending || (userLoc && APP.tractAt(userLoc.lat, userLoc.lon) === id ? userLoc : null); pending = null;
    const c = APP.centroid(f), here = pt ? [pt.lat, pt.lon] : [c[1], c[0]];
    m.textContent = pt && pt.label ? "Showing " + pt.label : "";
    const cards = centersNear(here[0], here[1]).map(placeCard).join("");
    const floodBox = `<div class="flood" id="pFlood"><span class="fi">🌊</span><div><b>Checking flood risk…</b></div></div>`;
    if (p.nonres) {
      body.innerHTML = `<div class="card"><div class="area-title">${/jail/i.test(p.csa) ? "Baltimore City jail complex" : "Non-residential area"}</div><p class="summary">Nobody lives here, so it isn't compared with neighborhoods.</p>${floodBox}</div><div class="section-h"><h2>Closest help</h2></div><div class="place-list">${cards}</div>`;
    } else {
      const lv = k => level(p["t_" + k]);
      const hot = lv("heat") >= 3, shade = lv("trees") >= 3;
      const sum = [`${p.csa} is ${lv("heat") >= 3 ? "hotter in summer than most of Baltimore" : lv("heat") <= 1 ? "cooler in summer than most of Baltimore" : "about average for summer heat"}`];
      if (shade) sum.push("has less tree shade than most"); else if (lv("trees") <= 1) sum.push("has more tree shade than most");
      const worst = Object.keys(THEMES).filter(k => lv(k) >= 0).sort((a, b) => (p["t_" + b] ?? 0) - (p["t_" + a] ?? 0));
      let top3 = worst.filter(k => lv(k) >= 3).slice(0, 3); top3 = [...top3, ...["heat", "trees", "health"].filter(k => !top3.includes(k))].slice(0, 3);
      const unsure = Object.keys(THEMES).some(k => p["u_" + k]);
      body.innerHTML = `<div class="area-hero">
        <div class="card"><span class="muted" style="font-size:.92rem">Your neighborhood</span><div class="area-title">${U.esc(p.csa)}</div>
          <p class="summary">${U.esc(sum.join(" and "))}.</p>${floodBox}</div>
        <div class="card"><h3 style="margin-bottom:2px">How it compares with the rest of Baltimore</h3><p class="note" style="margin-top:0">Left is easier, right is harder.</p><div class="meters">${Object.entries(THEMES).map(([k, t]) => { const l = lv(k);
          return `<div class="meterrow"><div class="t"><b>${t.icon} ${t.title}</b><span>${l < 0 ? "No data" : t.words[l]}</span></div><div><div class="scale on" style="--c:${LEVEL_C[Math.max(0, l)]}">${[0, 1, 2, 3, 4].map(n => `<i class="${n <= l ? "f" : ""}"></i>`).join("")}</div></div></div>`; }).join("")}</div>
          ${unsure ? `<p class="note">Some of these come from survey estimates that can be off for small areas.</p>` : ""}</div></div>
        <div class="section-h"><h2>What you can do</h2></div>
        <ul class="todo">${top3.map(k => { const [i, t, d, href] = ACTIONS[k]; return `<li><span class="ti">${i}</span><div><b>${href ? `<a href="${href}"${href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${t}</a>` : t}</b><span>${d}</span></div></li>`; }).join("")}</ul>
        <div class="section-h"><h2>Closest help</h2><a href="#help">All places and phone numbers</a></div>
        <div class="place-list">${cards}</div>
        <p class="note" style="margin-top:16px">Want the numbers behind this? <a href="#report/${id}">Open the detailed report in researcher mode</a>.</p>`;
    }
    pLayer.setStyle(g => g.properties.id === id ? { color: "#1d5c8c", weight: 3, fillOpacity: .22, fillColor: "#f2b705" } : g.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .6, fillOpacity: .04, fillColor: "#999" });
    if (pMarker) pMarker.remove(); if (pt) pMarker = L.marker([pt.lat, pt.lon]).addTo(pMap);
    pMap.invalidateSize(); pLayer.eachLayer(l => { if (l.feature.properties.id === id) { try { pMap.flyToBounds(l.getBounds(), { maxZoom: 15, padding: [30, 30], duration: .8 }); } catch { pMap.fitBounds(l.getBounds(), { maxZoom: 15 }); } } });
    LIVE.floodAt(here[0], here[1]).then(r => { const el = U.$("#pFlood"); if (!el) return; const w = floodWords(r);
      el.style.background = `color-mix(in srgb,${w.c} 12%,var(--surface))`; el.innerHTML = `<span class="fi">${w.icon}</span><div><b>${w.short}${pt ? "" : " (center of the area)"}</b><br><span style="font-size:.93rem">${w.long}</span></div>`; })
      .catch(() => { const el = U.$("#pFlood"); if (el) el.innerHTML = `<span class="fi">🌊</span><div><b>Flood map didn't answer</b><br><span style="font-size:.93rem">Try again in a minute, or check the <a href="https://msc.fema.gov/portal/home" target="_blank" rel="noopener">FEMA flood map</a>.</span></div>`; });
    window.scrollTo({ top: 0 });
  }

  // ======================= MAP =======================
  const GROUPS = [
    ["centers", "Cool off & warm up", "🏠", ["cool", "warm"]],
    ["parks", "Parks & pools", "🌳", ["parks", "pools", "rec"]],
    ["fountains", "Water fountains", "🚰", ["fountains"]],
    ["transit", "Bus & rail, bike lanes", "🚆", ["transit", "bike"]],
    ["food", "Markets & gardens", "🧺", ["markets", "gardens"]],
    ["ev", "EV chargers", "🔌", ["ev"]],
    ["recycling", "Recycling", "♻️", ["recycling"]],
    ["flood", "Flood zones", "🌊", ["flood"]],
    ["air", "Air monitors", "💨", ["airmon"]],
  ];
  let map, shade, on = {}, loaded = {};
  function mapInit() {
    map = APP.makeMap("mainMap");
    U.$("#mapColor").innerHTML = `<option value="t_heat">Summer heat</option><option value="t_trees">Tree shade</option><option value="none">Nothing</option>`;
    U.$("#mapColor").onchange = e => paint(e.target.value);
    shade = L.geoJSON(D().tracts, { interactive: false }).addTo(map); paint("t_heat");
    U.$("#mapChips").innerHTML = GROUPS.map(([k, t, i]) => `<button class="chipbtn" data-g="${k}" aria-pressed="false">${i} ${t}</button>`).join("");
    U.$$("#mapChips .chipbtn").forEach(b => b.onclick = () => toggleGroup(b));
    map.on("click", e => mapClick(e.latlng));
    toggleGroup(U.$('[data-g="centers"]'));
  }
  function paint(key) {
    if (key === "none") { shade.setStyle(f => f.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .4, fillOpacity: 0 }); if (map._ccpLegend) map.removeControl(map._ccpLegend); map._ccpLegend = null; return; }
    const R = key === "t_trees" ? [...U.RAMP_GREEN].reverse() : U.RAMP;
    shade.setStyle(f => { if (f.properties.nonres) return APP.NONRES_STYLE; const l = level(f.properties[key]); return { color: "#fff", weight: .5, fillOpacity: l < 0 ? .05 : .55, fillColor: l < 0 ? "#bbb" : R[l] }; });
    APP.legend(map, key === "t_heat" ? "Summer heat" : "Tree shade", key === "t_heat" ? [[U.RAMP[4], "Hottest"], [U.RAMP[2], "Average"], [U.RAMP[0], "Coolest"]] : [[R[0], "Most shade"], [R[2], "Average"], [R[4], "Least shade"]]);
  }
  async function toggleGroup(b) {
    const g = GROUPS.find(x => x[0] === b.dataset.g), turnOn = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(turnOn));
    const msgEl = U.$("#mapMsg");
    for (const k of g[3]) {
      if (!turnOn) { if (loaded[k]) { map.removeLayer(loaded[k]); if (loaded[k]._unsub) { loaded[k]._unsub(); delete loaded[k]; } } continue; }
      if (loaded[k]) { loaded[k].addTo(map); continue; }
      b.classList.add("busy");
      try { loaded[k] = await LAYERS.load(k, { emoji: true }); loaded[k].addTo(map); }
      catch { msgEl.textContent = `${LAYERS.DEF[k].label} didn't load. Try again in a minute.`; b.setAttribute("aria-pressed", "false"); }
      b.classList.remove("busy");
    }
    if (turnOn && g[0] === "flood") msgEl.textContent = "Blue areas are FEMA flood zones. Tap any spot to check it.";
  }
  async function mapClick(ll) {
    const id = APP.tractAt(ll.lat, ll.lng), p = id ? D().byId[id].properties : null;
    const pop = L.popup({ maxWidth: 270 }).setLatLng(ll).openOn(map);
    const heat = p && !p.nonres ? THEMES.heat.words[level(p.t_heat)] : null;
    pop.setContent(p ? `<h4>${U.esc(p.nonres ? "Non-residential area" : p.csa)}</h4>${heat ? `🔥 ${heat}<br>` : ""}<span id="mpFlood">🌊 Checking flood risk…</span>${p.nonres ? "" : `<br><a href="#" id="mpGo">See this block</a>`}` : "<h4>Outside Baltimore City</h4>");
    const go = document.getElementById("mpGo"); if (go) go.onclick = e => { e.preventDefault(); pick(ll.lat, ll.lng, "Spot on the map"); };
    if (!p) return;
    try { const r = await LIVE.floodAt(ll.lat, ll.lng); const el = document.getElementById("mpFlood"); if (el) el.textContent = (r.level >= 2 ? "🌊 " : r.level ? "🌧️ " : "✅ ") + floodWords(r).short; }
    catch { const el = document.getElementById("mpFlood"); if (el) el.textContent = "🌊 Flood map didn't answer"; }
  }

  // ======================= HELP =======================
  function helpShow() {
    const s = LIVE.season(), C = D().centers, W = C.winter;
    U.$("#helpIntro").textContent = s === "winter" ? "It's winter shelter season. Warming centers and shelters open whenever the wind chill reaches 32°F or below." :
      s === "summer" ? "It's heat season. Cooling centers open on Code Red heat days." : "Warming centers open for the winter from November 15. Cooling centers open on Code Red heat days.";
    const calls = [["🚨", "Emergency", "Heat stroke, hypothermia, any emergency", "911", "911", true], ["🏛️", "Baltimore 311", "City services, center hours, report problems", "311", "311"], ["🤝", "211 Maryland", "Food, rent and utility help, 24/7, any language", "211", "2-1-1"],
      ["🛏️", "Shelter Hotline", "Shelter beds and warming centers", "4439849540", "443-984-9540"], ["🌙", "Winter Shelter Hotline", "9 pm to midnight in winter", "4436957378", "443-695-7378"], ["💡", "Heating bill help", "Community Action Partnership", "4103965555", "410-396-5555"]];
    U.$("#helpCalls").innerHTML = calls.map(([i, t, d, tel, show, urgent]) => `<div class="callrow${urgent ? " urgent" : ""}"><span class="ci">${i}</span><div><b>${t}</b><small>${d}</small><span class="num">${show}</span></div><a class="round call${urgent ? " urgent" : ""}" href="tel:${tel}" aria-label="Call ${t} at ${show}" title="Call ${show}">${ICON_PHONE}</a></div>`).join("");
    const here = userLoc ? [userLoc.lon, userLoc.lat] : [LIVE.CENTER[1], LIVE.CENTER[0]];
    U.$("#helpPlacesTitle").textContent = userLoc ? "Places near " + (userLoc.label || "you").split(",")[0] : "Places near downtown";
    const cool = C.cooling.map(x => ({ ...x, kind: "cool" })), warm = W.sites.filter(x => x.lat != null).map(x => ({ ...x, kind: "warm" }));
    const key = a => (a || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 2).join(" ");
    const wk = new Set(warm.map(x => key(x.address)));
    const list = (s === "summer" ? cool : s === "winter" ? warm : [...warm.filter(x => x.type === "Warming center"), ...cool.filter(x => !wk.has(key(x.address)))]).map(x => ({ ...x, d: U.km(here, [x.lon, x.lat]) })).sort((a, b) => a.d - b.d).slice(0, 8);
    U.$("#helpPlaces").innerHTML = list.map(placeCard).join("") + `<p class="note">Centers open only when the city activates them. Call 311 to check. Overnight shelters: call the Shelter Hotline first.</p>`;
    U.$("[data-near]").onclick = e => { e.preventDefault(); navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { userLoc = { lat: p.coords.latitude, lon: p.coords.longitude, label: "your location" }; U.store.set("loc", userLoc); helpShow(); }, () => U.toast("Location is turned off. Search your address on the My block tab instead.")); };
    const P = [["🌳", "TreeBaltimore", "A free street tree, planted and watered for you.", "https://www.treebaltimore.org"],
      ["💡", "Energy bill help (OHEP)", "Help with electric and gas bills and past-due balances.", "https://dhs.maryland.gov/office-of-home-energy-programs/"],
      ["🏥", "Baltimore City Health Department", "Code Red heat and Code Blue cold alerts, clinics.", "https://health.baltimorecity.gov"],
      ["🛏️", "Winter shelter updates", "When winter shelters open, from the Mayor's Office of Homeless Services.", "https://www.baltimorecity.gov/homeless/winter-shelter"],
      ["🌊", "FEMA flood maps", "The official flood map for any address.", "https://msc.fema.gov/portal/home"],
      ["🚌", "Maryland Transit", "Buses, Light RailLink, Metro and MARC trip planner.", "https://www.mta.maryland.gov"],
      ["📝", "Report a problem (311)", "Street flooding, empty tree pits, dumping, no heat.", "https://311.baltimorecity.gov"]];
    U.$("#helpPrograms").innerHTML = P.map(([i, t, d, u]) => `<div class="place"><span class="pi" style="background:var(--tint)">${i}</span><div><b>${t}</b><small class="muted">${d}</small></div><div class="go"><a class="round link" href="${u}" target="_blank" rel="noopener" aria-label="Open ${t} website" title="Open website">${ICON_LINK}</a></div></div>`).join("");
  }

  return { views: {
    today: { show: homeShow, unit: drawHome },
    place: { init: placeInit, show: placeShow },
    map: { init: mapInit, reload() { shade.clearLayers(); shade.addData(D().tracts); paint(U.$("#mapColor").value); } },
    help: { show: helpShow },
  }, short, aqiNow, level, THEMES };
})();
