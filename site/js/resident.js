/* Everyday views — plain language, quick actions.
   Today · My block · Map · Help. (Plan lives in planner.js, Data in research.js.) */
const RES = (() => {
  const D = () => APP.data;
  const F = id => LIVE.feeds[id];
  let userLoc = U.store.get("loc", null);
  const short = n => String(n || "").replace(/,?\s*MD\.?$/i, "").replace(/\s+AT BALTIMORE$/i, "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(At|Near|Nr|Of|To)\b/g, w => w.toLowerCase()).replace(/\bBlvd\b/, "Blvd.").replace(/\bAve\b/, "Ave.");
  function aqiNow() {
    const m = (F("airnow").value || []).find(x => x.km < 25), AQ = F("air").value;
    return m ? { aqi: m.aqi, site: m.name, km: m.km, time: m.time, mon: m } : { aqi: AQ?.current.us_aqi ?? null, site: null };
  }
  const curHour = h => { const now = Date.now(); let i = h.time.findIndex(t => new Date(t).getTime() > now); return Math.max(0, (i < 0 ? h.time.length : i) - 1); };
  const hourLabel = t => new Date(t).toLocaleTimeString(LOC(), { hour: "numeric" });
  const tile = (icon, color, size = 22) => `<span class="tile" style="--tc:${color}">${I(icon, size)}</span>`;
  const dirBtn = (lat, lon, name) => `<a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(name)}" title="Directions">${I("nav", 18)}</a>`;
  const LEVEL_C = ["var(--s0)", "var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];

  // ---------- plain-language wording ----------
  const THEMES = {
    heat:     { title: "Summer heat", icon: "thermo", words: ["Among the coolest areas", "Cooler than most of the city", "About average for Baltimore", "Hotter than most of the city", "Among the hottest areas"] },
    trees:    { title: "Shade from trees", icon: "tree", words: ["Lots of tree shade", "More shade than most", "About average shade", "Less shade than most", "Very little tree shade"] },
    health:   { title: "Health risks", icon: "heart", words: ["Among the lowest in the city", "Lower than most", "About average", "Higher than most", "Among the highest in the city"] },
    social:   { title: "Money and jobs", icon: "wallet", words: ["Among the least strained", "Less strained than most", "About average", "More strained than most", "Among the most strained"] },
    energy:   { title: "Housing and energy bills", icon: "home", words: ["Among the least strained", "Less strained than most", "About average", "More strained than most", "Among the most strained"] },
    mobility: { title: "Getting around and food", icon: "bus", words: ["Among the easiest", "Easier than most", "About average", "Harder than most", "Among the hardest"] },
  };
  const level = v => v == null ? -1 : v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0;
  const ACTIONS = {
    heat: ["snow", "Have a plan for hot days", "Know your nearest cooling center, keep blinds closed by day, and check on older neighbors. Call 311 on Code Red days."],
    trees: ["tree", "Get a free street tree", "TreeBaltimore plants trees for free. Young trees noticeably cool a block within about ten years.", "https://www.treebaltimore.org"],
    health: ["wind", "Check the air before you exercise", "On bad-air days, people with asthma or heart problems should keep outdoor activity light."],
    social: ["hands", "Call 2-1-1 for help with food, rent or bills", "211 Maryland is free, open 24/7, and connects you to local programs.", "tel:211"],
    energy: ["bolt", "Get help with energy bills", "Maryland's energy assistance program helps with electric and gas bills and past-due balances.", "https://dhs.maryland.gov/office-of-home-energy-programs/"],
    mobility: ["bus", "Plan trips by bus, rail or the free Circulator", "Maryland Transit's trip planner covers buses, Light RailLink and Metro.", "https://www.mta.maryland.gov"],
  };
  function feelsWord(T, RH, V) {
    const fc = LIVE.feelsCat(T, RH, V); if (!fc) return { fc: null, tip: "" };
    if (fc.kind === "heat") return { fc, tip: ["Comfortable.", "Warm. Drink water.", "Hot. Rest in shade and drink water often.", "Dangerously hot. Stay somewhere cool.", "Extreme heat. Stay indoors somewhere cool."][fc.lvl] };
    if (fc.kind === "cold") return { fc, tip: ["Cool. A light jacket helps.", "Cold. Wear a warm coat.", "Freezing. Cover up; warming centers may open.", "Dangerous cold. Limit time outside."][fc.lvl] };
    return { fc, tip: "Comfortable." };
  }

  // ======================= TODAY =======================
  function drawHome() {
    if (!U.$("#hWhen")) return;
    const W = F("weather").value, AQ = F("air").value, AL = F("alerts").value || [];
    U.$("#hWhen").innerHTML = `<span class="livedot"></span> Baltimore, ${new Date().toLocaleString(LOC(), { weekday: "long", hour: "numeric", minute: "2-digit" })}`;
    if (!W && !AQ) { if (F("weather").err) { U.$("#hAnswer").textContent = "Reconnecting to the weather service"; U.$("#hWhy").textContent = "This page tries again on its own."; } return; }
    const c = W?.current, now = aqiNow(), ac = LIVE.aqiCat(now.aqi);
    const fw = c ? feelsWord(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m) : { fc: null };
    const i0 = W ? curHour(W.hourly) : 0;
    const rainNext = W ? W.hourly.precipitation_probability.slice(i0, i0 + 12) : [];
    const rainMax = rainNext.length ? Math.max(...rainNext.map(x => x ?? 0)) : 0, rainAt = rainNext.findIndex(x => x >= 50);
    const severe = AL.some(x => /Extreme|Severe/.test(x.severity));
    const lvl = Math.max(fw.fc?.lvl || 0, Math.min(4, ac.lvl), severe ? 3 : 0);
    let ans = ["A good day to be outside", "Fine outside, with a little care", "Take it easy outside today", "Limit your time outside", "Stay inside if you can"][Math.min(lvl, 4)];
    if (lvl === 0 && rainMax >= 60) ans = "Fine outside, but bring an umbrella";
    U.$("#hAnswer").textContent = ans;
    const why = [];
    if (fw.fc && fw.fc.lvl > 0) why.push(fw.tip);
    if (ac.lvl > 0) why.push(`The air is ${ac.t.toLowerCase()}${ac.lvl === 1 ? ", fine for most people" : ""}.`);
    if (AL.length) why.push(`${AL[0].event} in effect.`);
    if (!why.length) why.push(`${c ? LIVE.WMO[c.weather_code] || "Calm" : "Calm"}, clean air${rainMax < 30 ? " and no rain expected" : ""}.`);
    U.$("#hWhy").textContent = why.map(I18N.t).join(" ");
    if (c) {
      const kind = LIVE.sky(c.weather_code), day = !!c.is_day, hot = fw.fc?.kind === "heat" && fw.fc.lvl >= 2, cold = fw.fc?.kind === "cold" && fw.fc.lvl >= 2;
      const cls = `sky ${day ? "day" : "night"} ${kind}${hot ? " hot" : ""}${cold ? " cold" : ""}`;
      const sky = U.$("#hSky"); if (sky.dataset.sky !== cls) { sky.dataset.sky = cls; CINEMA.hero(day, kind, hot, cold); }
      U.$("#hTemp").innerHTML = `<span class="tnum">${U.tF(c.temperature_2m)}</span><small>Feels like ${U.tF(fw.fc ? fw.fc.index : c.apparent_temperature)}</small>`;
    }
    const stat = (ic, t, v) => `<span class="stat">${I(ic, 16)}<span>${t}</span><b>${v}</b></span>`;
    U.$("#hStats").innerHTML = [now.aqi != null ? stat("wind", "Air", `${ac.t.replace("Unhealthy for sensitive groups", "Unhealthy for some")}`) : "",
      c ? stat("thermo", "Today", `${U.tF(W.daily.temperature_2m_min[0])} to ${U.tF(W.daily.temperature_2m_max[0])}`) : "",
      W ? stat(rainMax >= 50 ? "umbrella" : "droplet", "Rain", rainMax >= 50 && rainAt >= 0 ? `Around ${hourLabel(W.hourly.time[i0 + rainAt])}` : rainMax >= 20 ? `${rainMax}% chance` : "None expected") : ""].join("");
    PRIO.render(); CINEMA.features();
    if (W) {
      const H = W.hourly;
      U.$("#hHours").innerHTML = Array.from({ length: Math.min(12, H.time.length - i0) }, (_, k) => i0 + k).map((k, j) =>
        `<div class="hour"><span>${j === 0 ? "Now" : hourLabel(H.time[k])}</span>${FX.icon(H.weather_code[k], H.is_day ? H.is_day[k] : 1, 30)}<b class="tnum">${U.tF(H.temperature_2m[k])}</b><div class="rain">${(H.precipitation_probability[k] ?? 0) >= 20 ? H.precipitation_probability[k] + "%" : ""}</div></div>`).join("");
      const d = W.daily, lo = Math.min(...d.temperature_2m_min), hi = Math.max(...d.temperature_2m_max);
      U.$("#hWeek").innerHTML = d.time.map((t, k) => { const a = (d.temperature_2m_min[k] - lo) / (hi - lo || 1) * 100, b = (d.temperature_2m_max[k] - lo) / (hi - lo || 1) * 100;
        return `<div class="day"><b>${k === 0 ? "Today" : new Date(t + "T12:00").toLocaleDateString(LOC(), { weekday: "short" })}</b>${FX.icon(d.weather_code[k], 1, 26)}<span class="muted tnum" style="text-align:right">${U.tF(d.temperature_2m_min[k])}</span><div class="range"><i style="left:${a}%;width:${Math.max(4, b - a)}%"></i></div><span class="tnum">${U.tF(d.temperature_2m_max[k])}</span>${(d.precipitation_probability_max[k] ?? 0) >= 30 ? `<span class="rain">${d.precipitation_probability_max[k]}% chance of rain</span>` : ""}</div>`; }).join("");
    }
  }
  function drawMyArea() {
    const box = U.$("#hMyArea"); const id = userLoc && APP.tractAt(userLoc.lat, userLoc.lon);
    if (!id) { box.innerHTML = `<div class="myarea"><div style="display:flex;gap:14px;align-items:center">${tile("pin", "var(--link)")}<div><b style="font-size:1.04rem">See how your block compares</b><br><span class="muted">Add your address once to see its summer heat, flood risk and nearest help here.</span></div></div><a class="btn" href="#place">Add my address</a></div>`; return; }
    const p = D().byId[id].properties;
    const tags = p.nonres ? [] : ["heat", "trees"].map(k => { const l = level(p["t_" + k]); return l < 0 ? "" : `<span class="pill"><span class="dot" style="background:${LEVEL_C[l]}"></span>${THEMES[k].words[l]}</span>`; });
    box.innerHTML = `<div class="myarea"><div><span class="muted" style="font-size:.9rem">Your block, ${U.esc((userLoc.label || "").split(",")[0])}</span><br><b style="font-size:1.25rem;font-family:var(--display);letter-spacing:-.02em">${U.esc(p.csa)}</b><div class="tags">${tags.join("")}<span class="pill" id="myFlood">Checking flood risk</span></div></div><a class="btn alt" href="#place/${id}">Open report</a></div>`;
    LIVE.floodAt(userLoc.lat, userLoc.lon).then(r => { U.store.set("floodLvl", r.level); PRIO.render(); const el = U.$("#myFlood"); if (el) el.innerHTML = `<span class="dot" style="background:${["var(--s0)", "var(--s2)", "var(--s4)", "var(--s5)"][r.level]}"></span>${floodWords(r).short}`; }).catch(() => U.$("#myFlood")?.remove());
  }
  function drawActions() {
    const s = LIVE.season();
    const place = s === "winter" ? ["flame", "var(--s3)", "Find a warm place", "Warming centers and shelters near you"] : s === "summer" ? ["snow", "var(--link)", "Find a cool place", "Cooling centers near you on hot days"] : ["home", "var(--s3)", "Warm or cool places", "Warming centers open from November 15"];
    const A = [
      ["#help/sec-places", place[0], place[1], place[2], place[3]],
      ["#place", "pin", "var(--accent)", "Check my block", "Heat, flood risk and help near your address"],
      ["#plan", "calendar", "var(--s0)", "Plan my day", "The best hours for a walk, run or ride"],
      ["#help/sec-food", "basket", "#b8382b", "Food help", "Free food, pantries and stores that take SNAP"],
      ["#place/sec-transit", "bus", "#6b4c9a", "Buses near me", "Next scheduled buses and trains"],
      ["https://balt311.baltimorecity.gov/citizen/s/", "doc", "var(--link)", "Report a problem", "No heat, flooding, trash: tell 311"],
      ["#alerts", "bell", "var(--s3)", "Get alerts", "Texts or phone alerts for bad weather"],
      ["#map", "map", "#1e9e5a", "See the map", "Parks, fountains, centers, flood zones"],
    ];
    const el = U.$("#hActions"); el.classList.add("stagger", "eight");
    el.innerHTML = A.map(([h, ic, col, t, d, cls]) => `<a class="action ${cls || ""}" href="${h}"${h.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${cls ? `<span class="tile">${I(ic)}</span>` : tile(ic, col)}<b>${t}</b><span>${d}</span></a>`).join("");
  }
  document.addEventListener("click", e => { const a = e.target.closest('a[href="#alerts"]'); if (a) { e.preventDefault(); ALERTS.open(); } });
  // first-visit welcome: what this site is and where to start
  function drawWelcome() {
    const el = U.$("#hWelcome"); if (!el) return;
    if (U.store.get("welcomed", false)) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="welcome"><button class="iconbtn close-x" data-close aria-label="Close">${I("x", 18)}</button>
      <span class="eyebrow">New here?</span><h2>A free guide to Baltimore's weather, air and help</h2>
      <ul><li>${I("sun", 20)}<span><b>Today</b> tells you if it's safe to be outside right now.</span></li>
        <li>${I("pin", 20)}<span><b>My block</b> shows heat, flood risk, food and buses near your address.</span></li>
        <li>${I("phone", 20)}<span><b>Help</b> has phone numbers, warm and cool places, and your rights.</span></li></ul>
      <div class="cta"><a class="btn" href="#place">Start with my block</a><a class="btn alt" href="#guide">How it works</a><button class="btn alt" data-close>Got it</button></div></div>`;
    el.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { U.store.set("welcomed", true); el.innerHTML = ""; });
  }
  let homeWired = false;
  function homeShow(args = []) {
    drawActions(); drawWelcome(); drawMyArea(); CINEMA.features();
    if (args[0] === "details") setTimeout(() => { const d = U.$("#detailsBox"); d.open = true; d.dispatchEvent(new Event("toggle")); d.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
    if (homeWired) { drawHome(); DETAILS.redraw(); return; } homeWired = true;
    DETAILS.init();
    F("weather").on(drawHome); F("air").on(drawHome); F("airnow").on(drawHome); F("alerts").on(drawHome); F("city").on(drawHome);
    setInterval(() => { if (APP.view === "today") drawHome(); }, 60000);
  }

  // ======================= MY BLOCK =======================
  let pending = null;
  function pick(lat, lon, label, err) {
    if (err) return msg(err);
    const id = APP.tractAt(lat, lon);
    if (!id) return msg("That spot is outside Baltimore City. This site covers Baltimore City only.");
    userLoc = { lat, lon, label: label || "Spot on the map" }; U.store.set("loc", userLoc); pending = userLoc;
    if (location.hash === "#place/" + id) placeShow([id]); else location.hash = "place/" + id;
  }
  function msg(t) { if (!location.hash.startsWith("#place")) location.hash = "place"; setTimeout(() => { const m = U.$("#pMsg"); m.textContent = t; m.style.color = "var(--s4)"; }, 60); }
  const floodWords = r => r.level >= 2 ? { short: "High flood risk", long: `This spot is in FEMA's high-risk flood zone (zone ${r.zone}). Flood insurance is usually required with a mortgage, and it's worth having either way.`, c: "var(--s4)", icon: "waves" }
    : r.level === 1 ? { short: "Some flood risk", long: "This spot is in FEMA's moderate-risk area, the 500-year floodplain. Heavy rain can still flood streets and basements.", c: "var(--s2)", icon: "umbrella" }
    : { short: "Low flood risk", long: "This spot is outside FEMA's flood zones. Heavy rain can still flood streets and basements.", c: "var(--s0)", icon: "check" };
  const addrKey = a => (a || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 2).join(" ");
  function centersNear(lat, lon) {
    const s = LIVE.season(), C = D().centers, here = [lon, lat];
    const cool = C.cooling.map(x => ({ ...x, kind: "cool" })), warm = C.winter.sites.filter(x => x.lat != null && x.type === "Warming center").map(x => ({ ...x, kind: "warm" }));
    const near = l => l.map(x => ({ ...x, d: U.km(here, [x.lon, x.lat]) })).sort((a, b) => a.d - b.d);
    const w = near(warm), wk = new Set(w.map(x => addrKey(x.address))), c = near(cool).filter(x => !wk.has(addrKey(x.address)));
    return s === "winter" ? w.slice(0, 3) : s === "summer" ? near(cool).slice(0, 3) : [...w.slice(0, 2), ...c.slice(0, 2)];
  }
  const placeCard = x => `<div class="place">${x.kind === "warm" ? tile("flame", "var(--s3)") : tile("snow", "var(--link)")}
    <div><b>${U.esc(x.name)}</b><small>${U.esc(x.address.replace(/, Baltimore, MD \d+/, ""))}${x.hours ? ", " + U.esc(x.hours) : ""}</small><small>${x.kind === "warm" ? "Warming center, open on cold days Nov 15 to Mar 15" : "Cooling center, open on Code Red heat days"}${x.serves && x.serves !== "All" ? ". " + U.esc(x.serves) : ""}</small></div>
    <div class="go"><span class="tnum">${U.dist(x.d)}</span>${dirBtn(x.lat, x.lon, x.name)}</div></div>`;
  function numbersTable(p) {
    const ind = D().ind; let html = `<table class="numbers"><thead><tr><th>Measure</th><th class="n">Here</th><th class="n">City middle</th><th>Source year</th></tr></thead><tbody>`;
    D().catalog.themes.forEach(t => {
      html += `<tr class="cat"><td colspan="4">${U.esc(THEMES[t.key].title)}: score ${p["t_" + t.key] == null ? "no data" : Math.round(p["t_" + t.key]) + " of 100"}</td></tr>`;
      t.inputs.forEach(k => { const i = ind[k], u = p[k + (i.uncertainty === "se" ? "_se" : "_moe")], flag = (p["u_" + t.key] || []).includes(k);
        html += `<tr><td>${U.esc(i.label)}${flag ? ' <span class="chip warn">uncertain</span>' : ""}</td><td class="n">${U.fmt(p[k], i.decimals, i.unit)}${u != null ? `<br><small class="muted">±${U.fmt(u * (i.uncertainty === "se" ? 1.645 : 1), i.decimals)}</small>` : ""}</td><td class="n">${U.fmt(D().med[k], i.decimals, i.unit)}</td><td><small class="muted">${U.esc(i.vintage || "")}</small></td></tr>`; });
    });
    return html + `</tbody></table><p class="note">Scores rank each area against Baltimore's other residential census tracts (100 = hardest). ± shows the 90% margin of error. <a href="#explore">Explore every indicator</a></p>`;
  }
  let pMap, pLayer, pMarker;
  function placeInit() {
    APP.searchForm(U.$("#v-place form[data-geo]"), pick);
    pMap = APP.makeMap("pMap", { zoom: 12, scroll: false });
    pLayer = L.geoJSON(D().tracts, { style: f => f.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .6, fillOpacity: .04, fillColor: "#999" } }).addTo(pMap);
    pMap.on("click", e => pick(e.latlng.lat, e.latlng.lng, "Spot on the map"));
  }
  function placeShow([id]) {
    if (id && /^sec-/.test(id)) id = null;
    const body = U.$("#pBody"), m = U.$("#pMsg"); m.style.color = "";
    if (!id && userLoc) id = APP.tractAt(userLoc.lat, userLoc.lon);
    if (!id || !D().byId[id]) {
      m.textContent = "";
      body.innerHTML = `<div class="myarea" style="margin-top:6px"><div style="display:flex;gap:14px;align-items:center">${tile("locate", "var(--link)")}<div><b>No address yet</b><br><span class="muted">Search above, tap the map below, or let your phone find you.</span></div></div><button class="btn" id="pLocate">Use my location</button></div>`;
      U.$("#pLocate").onclick = () => U.$("#v-place [data-locate]").click(); return;
    }
    const f = D().byId[id], p = f.properties;
    const pt = pending || (userLoc && APP.tractAt(userLoc.lat, userLoc.lon) === id ? userLoc : null); pending = null;
    const c = APP.centroid(f), here = pt ? [pt.lat, pt.lon] : [c[1], c[0]];
    m.textContent = pt && pt.label ? "Showing " + pt.label : "";
    const cards = centersNear(here[0], here[1]).map(placeCard).join("");
    const floodBox = `<div class="flood" id="pFlood">${tile("waves", "var(--link)")}<div><b>Checking flood risk</b></div></div>`;
    if (p.nonres) {
      body.innerHTML = `<div class="card"><div class="area-title">${/jail/i.test(p.csa) ? "Baltimore City jail complex" : "Non-residential area"}</div><p class="summary">Nobody lives here, so it isn't compared with neighborhoods.</p>${floodBox}</div><div class="section-h"><h2>Closest help</h2></div><div class="place-list stagger">${cards}</div>`;
    } else {
      const lv = k => level(p["t_" + k]);
      const sum = [`${p.csa} is ${lv("heat") >= 3 ? "hotter in summer than most of Baltimore" : lv("heat") <= 1 ? "cooler in summer than most of Baltimore" : "about average for summer heat"}`];
      if (lv("trees") >= 3) sum.push("has less tree shade than most"); else if (lv("trees") <= 1) sum.push("has more tree shade than most");
      const worst = Object.keys(THEMES).filter(k => lv(k) >= 0).sort((a, b) => (p["t_" + b] ?? 0) - (p["t_" + a] ?? 0));
      let top3 = worst.filter(k => lv(k) >= 3).slice(0, 3); top3 = [...top3, ...["heat", "trees", "health"].filter(k => !top3.includes(k))].slice(0, 3);
      const unsure = Object.keys(THEMES).some(k => p["u_" + k]);
      const J = (k, t) => `<a href="#place/${id}/${k}">${t}</a>`;
      body.innerHTML = `<nav class="jumpbar" aria-label="On this page"><span>On this page</span>${J("sec-summary", "Summary")}${J("sec-help", "Closest help")}${J("sec-food", "Food")}${J("sec-transit", "Buses")}${J("sec-trends", "Changes")}${J("sec-numbers", "All numbers")}</nav>
        <div class="area-hero" id="sec-summary">
        <div class="card"><span class="muted" style="font-size:.92rem">Your neighborhood</span><div class="area-title">${U.esc(p.csa)}</div>
          <p class="summary">${U.esc(sum.join(" and "))}.</p>${floodBox}</div>
        <div class="card"><h3 style="margin-bottom:2px">Compared with the rest of Baltimore</h3><p class="note" style="margin-top:0">Fewer bars is easier, more bars is harder.</p><div class="meters">${Object.entries(THEMES).map(([k, t]) => { const l = lv(k);
          return `<div class="meterrow"><div class="t">${tile(t.icon, l < 0 ? "var(--ink-3)" : LEVEL_C[l], 20).replace('class="tile"', 'class="tile sm"')}<div><b>${t.title}</b><span>${l < 0 ? "No data" : t.words[l]}</span></div></div><div class="scale on" style="--c:${LEVEL_C[Math.max(0, l)]}">${[0, 1, 2, 3, 4].map(n => `<i class="${n <= l ? "f" : ""}"></i>`).join("")}</div></div>`; }).join("")}</div>
          ${unsure ? `<p class="note">Some of these come from survey estimates that can be off for small areas.</p>` : ""}</div></div>
        <div class="section-h"><h2>What you can do</h2></div>
        <ul class="todo stagger">${top3.map(k => { const [ic, t, d, href] = ACTIONS[k]; return `<li>${tile(ic, "var(--link)")}<div><b>${href ? `<a href="${href}"${href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${t}</a>` : t}</b><span>${d}</span></div></li>`; }).join("")}</ul>
        <div class="section-h" id="sec-help"><h2>Closest help</h2><a href="#help">All places and phone numbers</a></div>
        <div class="place-list stagger">${cards}${MORE.leadCard(p, null)}</div>
        <div id="pReport"></div>
        <div class="section-h" id="sec-food"><div><h2>Food help nearby</h2><p class="sub">Free food sites and stores that take SNAP (EBT).</p></div><a href="#help/sec-food">More food help</a></div>
        <div class="place-list" id="pFood"><div class="skeleton" style="height:70px"></div></div>
        <div class="section-h" id="sec-transit"><div><h2>Buses and trains nearby</h2><p class="sub">The next scheduled times at the closest stops.</p></div></div>
        <div class="place-list" id="pTransit"><div class="skeleton" style="height:70px"></div></div>
        <div class="section-h" id="sec-trends"><div><h2>How this neighborhood is changing</h2><p class="sub">Red means things got harder; green means they eased.</p></div></div>
        <div id="pTrends"></div>
        <details class="more" id="sec-numbers"><summary>${tile("chart", "var(--ink)", 20).replace('class="tile"', 'class="tile sm"')}<span>See the numbers<br><small style="font-weight:500">Every measure behind these comparisons, with margins of error and source years</small></span>${I("chev", 20).replace('class="ic"', 'class="ic chev"')}</summary><div class="inner"><div class="card" style="overflow-x:auto">${numbersTable(p)}</div></div></details>
        <div class="report-actions"><button class="btn small" data-print>Print or save as PDF</button><button class="btn small alt" data-share>Copy link to this report</button></div>
        <p class="note print-only">Charm City Pulse report for ${U.esc(p.csa)} (census tract ${U.esc(p.name.replace("Tract ", ""))}), data build ${new Date(D().meta.built).toLocaleDateString(LOC(), { dateStyle: "long" })}. ${location.origin}${location.pathname}#place/${id}</p>`;
      MORE.foodSection(U.$("#pFood"), here[0], here[1]); MORE.transitSection(U.$("#pTransit"), here[0], here[1]); MORE.trendsSection(U.$("#pTrends"), p.csa);
      MORE.file("trends.json").then(T => { const lc = MORE.leadCard(p, T.csa[p.csa]); const old = body.querySelector(".place.lead"); if (old) old.outerHTML = lc; else if (lc) body.querySelector(".place-list").insertAdjacentHTML("beforeend", lc); }).catch(() => {});
      body.querySelector("[data-print]").onclick = () => { body.querySelectorAll("details.more").forEach(d => d.open = true); window.print(); };
      body.querySelector("[data-share]").onclick = () => SHARE.link(`${location.origin}${location.pathname}#place/${id}`, `${p.csa}: heat, flood risk and help nearby`);
    }
    pLayer.setStyle(g => g.properties.id === id ? { color: "#0c1c2c", weight: 3, fillOpacity: .25, fillColor: "#e8a800" } : g.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .6, fillOpacity: .04, fillColor: "#999" });
    if (pMarker) pMarker.remove(); if (pt) pMarker = L.marker([pt.lat, pt.lon]).addTo(pMap);
    pMap.invalidateSize(); pLayer.eachLayer(l => { if (l.feature.properties.id === id) { try { pMap.flyToBounds(l.getBounds(), { maxZoom: 15, padding: [30, 30], duration: .8 }); } catch { pMap.fitBounds(l.getBounds(), { maxZoom: 15 }); } } });
    LIVE.floodAt(here[0], here[1]).then(r => { const el = U.$("#pFlood"); if (!el) return; const w = floodWords(r);
      el.style.background = `color-mix(in srgb,${w.c} 10%,var(--surface))`; el.innerHTML = `${tile(w.icon, w.c)}<div><b>${w.short}${pt ? "" : " (center of the area)"}</b><br><span style="font-size:.93rem;color:var(--ink-2)">${w.long}</span></div>`;
      const rp = U.$("#pReport"); if (rp) rp.innerHTML = MORE.report("flood") + MORE.report("basement"); })
      .catch(() => { const el = U.$("#pFlood"); if (el) el.innerHTML = `${tile("waves", "var(--ink-3)")}<div><b>The flood map didn't answer</b><br><span style="font-size:.93rem">Try again in a minute, or check the <a href="https://msc.fema.gov/portal/home" target="_blank" rel="noopener">FEMA flood map</a>.</span></div>`; });
    window.scrollTo({ top: 0 });
  }

  // ======================= MAP =======================
  const GROUPS = [
    ["centers", "Cool off & warm up", "home", "#d26a1c", ["cool", "warm"]],
    ["parks", "Parks & pools", "tree", "#1e9e5a", ["parks", "pools", "rec"]],
    ["fountains", "Water fountains", "fountain", "#1d8fc9", ["fountains"]],
    ["transit", "Rail & bike lanes", "train", "#6b4c9a", ["transit", "bike"]],
    ["food", "Markets & gardens", "basket", "#b8382b", ["markets", "gardens"]],
    ["ev", "EV chargers", "plug", "#b98500", ["ev"]],
    ["recycling", "Recycling", "recycle", "#3f7f8c", ["recycling"]],
    ["flood", "Flood zones", "waves", "#2f78c4", ["flood"]],
    ["air", "Air monitors", "wind", "#1e9e5a", ["airmon"]],
    ["streams", "Stream gauges", "droplet", "#0c1c2c", ["gauges"]],
    ["foodhelp", "Food help", "hands", "#2f8a5b", ["foodsites", "snap"]],
    ["stops", "Bus & rail stops", "bus", "#6b4c9a", ["stops"]],
    ["harbor", "Harbor water", "waves", "#1d6fb8", ["harbor"]],
    ["sensors", "Air sensors", "wind", "#24804f", ["sensors"]],
  ];
  const SHADES = [["t_heat", "Summer heat"], ["t_trees", "Tree shade"], ["hvi", "Heat vulnerability"], ["t_health", "Health risks"], ["t_social", "Money and jobs"], ["t_energy", "Housing and energy bills"], ["t_mobility", "Getting around and food"], ["none", "Nothing"]];
  let map, shade, loaded = {};
  function mapInit() {
    map = APP.makeMap("mainMap");
    U.$("#mapColor").innerHTML = SHADES.map(([k, t]) => `<option value="${k}">${t}</option>`).join("");
    U.$("#mapColor").onchange = e => paint(e.target.value);
    shade = L.geoJSON(D().tracts, { interactive: false }).addTo(map); paint("t_heat");
    const chip = ([k, t, ic, col]) => `<button class="chipbtn" data-g="${k}" aria-pressed="false" style="--c:${col}">${I(ic, 18)}${t}</button>`;
    const SETS = [["Stay safe", ["centers", "flood", "air", "sensors", "streams"]], ["Everyday places", ["foodhelp", "parks", "fountains", "food", "recycling", "harbor"]], ["Getting around", ["stops", "transit", "ev"]]];
    U.$("#mapChips").innerHTML = SETS.map(([t, ks]) => `<div class="chipset"><span class="chipset-t">${t}</span><div class="chips-in">${ks.map(k => GROUPS.find(g => g[0] === k)).filter(Boolean).map(chip).join("")}</div></div>`).join("");
    U.$$("#mapChips .chipbtn").forEach(b => b.onclick = () => toggleGroup(b));
    map.on("click", e => mapClick(e.latlng));
    toggleGroup(U.$('[data-g="centers"]'));
  }
  function paint(key) {
    if (key === "none") { shade.setStyle(f => f.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .4, fillOpacity: 0 }); if (map._ccpLegend) map.removeControl(map._ccpLegend); map._ccpLegend = null; return; }
    const isScore = key.startsWith("t_"), R = key === "t_trees" ? ["#1f6b3f", "#4e9a57", "#a9cf8f", "#e6f0d8", "#f6f2e4"] : U.RAMP;
    const br = isScore ? null : U.breaks(D().res.map(f => f.properties[key]));
    shade.setStyle(f => { if (f.properties.nonres) return APP.NONRES_STYLE; const l = isScore ? level(f.properties[key]) : U.classify(f.properties[key], br); return { color: "#fff", weight: .5, fillOpacity: l < 0 ? .05 : .58, fillColor: l < 0 ? "#bbb" : R[l] }; });
    const name = SHADES.find(s => s[0] === key)[1];
    APP.legend(map, name, key === "t_trees" ? [[R[0], "Most shade"], [R[2], "Average"], [R[4], "Least shade"]] : [[U.RAMP[4], "Hardest in the city"], [U.RAMP[2], "About average"], [U.RAMP[0], "Easiest"]]);
  }
  async function toggleGroup(b) {
    const g = GROUPS.find(x => x[0] === b.dataset.g), turnOn = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(turnOn));
    const msgEl = U.$("#mapMsg");
    for (const k of g[4]) {
      if (!turnOn) { if (loaded[k]) { map.removeLayer(loaded[k]); if (loaded[k]._unsub) { loaded[k]._unsub(); delete loaded[k]; } } continue; }
      if (loaded[k]) { loaded[k].addTo(map); continue; }
      b.classList.add("busy");
      try { loaded[k] = await LAYERS.load(k, { pins: true, map, onCount: n => { if (k === "sensors" && !n) msgEl.textContent = "No neighborhood air sensors are reporting right now. EPA monitors are under Air monitors."; } }); loaded[k].addTo(map); }
      catch { msgEl.textContent = `${LAYERS.DEF[k].label} didn't load. Try again in a minute.`; b.setAttribute("aria-pressed", "false"); }
      b.classList.remove("busy");
    }
    if (turnOn && g[0] === "flood") msgEl.textContent = "Blue areas are FEMA flood zones. Tap any spot to check it.";
    if (turnOn && g[0] === "stops") { msgEl.textContent = "Zoom in to see bus and rail stops. Tap one for its next scheduled times."; if (map.getZoom() < 15) map.setZoom(15); }
  }
  async function mapClick(ll) {
    const id = APP.tractAt(ll.lat, ll.lng), p = id ? D().byId[id].properties : null;
    const pop = L.popup({ maxWidth: 270 }).setLatLng(ll).openOn(map);
    const heat = p && !p.nonres ? THEMES.heat.words[level(p.t_heat)] : null;
    pop.setContent(p ? `<h4>${U.esc(p.nonres ? "Non-residential area" : p.csa)}</h4>${heat ? `Summer heat: ${heat}<br>` : ""}<span id="mpFlood">Checking flood risk</span>${p.nonres ? "" : `<br><a href="#" id="mpGo">See this block</a>`}` : "<h4>Outside Baltimore City</h4>");
    const go = document.getElementById("mpGo"); if (go) go.onclick = e => { e.preventDefault(); pick(ll.lat, ll.lng, "Spot on the map"); };
    if (!p) return;
    try { const r = await LIVE.floodAt(ll.lat, ll.lng); const el = document.getElementById("mpFlood"); if (el) el.textContent = "Flood risk: " + floodWords(r).short.replace(" flood risk", "").toLowerCase(); }
    catch { const el = document.getElementById("mpFlood"); if (el) el.textContent = "The flood map didn't answer"; }
  }

  // ======================= HELP =======================
  // Plain-language rights for renters and utility customers. Sources: Baltimore City Building, Fire and
  // Related Codes §602.3 (heat), COMAR 20.31.02-.03 (Maryland utility shut-off rules), Maryland DHS OHEP.
  function rights() {
    const m = new Date().getMonth() + 1, cold = m >= 10 || m <= 4;
    const R = cold ? [
      ["home", "var(--s3)", "Your landlord must keep your home warm", "From October 1 to April 30, Baltimore's code requires rented homes to average at least 70°F in bedrooms, living rooms and bathrooms, and 65°F in other rooms. If the heat is out, tell your landlord in writing, keep a copy, and call 311 to report it.", "https://codes.baltimorecity.gov/us/md/cities/baltimore/code/building-codes/VII/602", "Read the heat rule"],
      ["bolt", "var(--accent)", "Gas and electric can't simply be cut off in winter", "From November 1 to March 31, BGE must first certify to the Maryland Public Service Commission that a shut-off won't endanger anyone's life or health. It can't shut off service for unpaid bills during stretches when the forecast stays at or below 32°F.", "https://www.psc.state.md.us/", "Maryland Public Service Commission"],
      ["hospital", "var(--s4)", "A serious illness can delay a shut-off", "If someone at home is seriously ill or uses life-support equipment, a certificate from their doctor can postpone a shut-off by 30 days. Ask BGE for the medical certification form, then set up a payment plan within those 30 days.", "https://www.psc.state.md.us/", "Maryland Public Service Commission"],
      ["hands", "var(--s0)", "Get help paying the bill", "Maryland's energy assistance helps with heating and electric bills, and can pay up to $2,000 of a past-due balance of $300 or more. Apply online, call 1-800-332-6347, or in Baltimore call 410-396-5555.", "https://benefits.maryland.gov/", "Apply for energy assistance"],
    ] : [
      ["bolt", "var(--accent)", "No shut-offs during heat waves", "BGE can't shut off electric service for unpaid bills during stretches when the forecast heat index is 95°F or higher.", "https://www.psc.state.md.us/", "Maryland Public Service Commission"],
      ["hospital", "var(--s4)", "A serious illness can delay a shut-off", "If someone at home is seriously ill or uses life-support equipment, a certificate from their doctor can postpone a shut-off by 30 days. Ask BGE for the medical certification form, then set up a payment plan within those 30 days.", "https://www.psc.state.md.us/", "Maryland Public Service Commission"],
      ["hands", "var(--s0)", "Get help paying the bill", "Maryland's energy assistance helps with electric bills, and can pay up to $2,000 of a past-due balance of $300 or more. Apply online, call 1-800-332-6347, or in Baltimore call 410-396-5555.", "https://benefits.maryland.gov/", "Apply for energy assistance"],
    ];
    U.$("#rightsTitle").textContent = cold ? "Your rights in cold weather" : "Your rights in hot weather";
    return R.map(([ic, col, t, d, u, lk]) => `<div class="place">${tile(ic, col)}<div><b>${t}</b><small>${d}</small><small><a href="${u}" target="_blank" rel="noopener">${lk}</a></small></div></div>`).join("") +
      `<p class="note">This is general information, not legal advice. For help with a landlord or utility dispute, call 211 or Maryland Legal Aid at 1-888-465-2468.</p>`;
  }

  // Whether the city has declared a Code Blue (cold) or Code Red (heat) right now
  function codeStatus() {
    const c = F("city").value; if (!c) return "";
    const d = s => new Date(s + "T12:00:00").toLocaleDateString(LOC(), { month: "long", day: "numeric" });
    const on = ["blue", "red"].map(k => LIVE.cityAlert(k)).filter(Boolean);
    if (on.length) return on.map(a => `<div class="codebar ${a.kind}">${tile(a.kind === "blue" ? "snow" : "thermo", "#fff")}<div><b>${a.kind === "blue" ? "Code Blue is in effect" : "Code Red is in effect"} through ${d(a.until)}</b><span>${a.kind === "blue" ? "All emergency shelters are open. Call the Shelter Hotline at 443-984-9540 for a bed." : "Cooling centers are open. Call 311 for hours."} <a href="${U.esc(a.url)}" target="_blank" rel="noopener">City announcement</a></span></div></div>`).join("");
    const season = LIVE.season() === "summer" ? "red" : "blue", last = c.last?.[season];
    return `<div class="codebar none">${tile("check", "var(--s0)")}<div><b>No Code Blue or Code Red in effect right now</b><span>Checked hourly against the Baltimore City Health Department's announcements.${last ? ` Last ${season === "blue" ? "Code Blue" : "Code Red"}: ${d(last.posted)}.` : ""}</span></div></div>`;
  }
  function helpShow() {
    const s = LIVE.season(), C = D().centers, W = C.winter;
    U.$("#helpIntro").textContent = s === "winter" ? "It's winter shelter season. Warming centers and shelters open whenever the wind chill reaches 32°F or below." :
      s === "summer" ? "It's heat season. Cooling centers open on Code Red heat days." : "Warming centers open for the winter from November 15. Cooling centers open on Code Red heat days.";
    const calls = [["alert", "var(--red)", "Emergency", "Heat stroke, hypothermia, any emergency", "911", "911", true], ["building", "var(--link)", "Baltimore 311", "City services, center hours, report problems", "311", "311"], ["hands", "var(--s0)", "211 Maryland", "Food, rent and utility help, 24/7, any language", "211", "2-1-1"],
      ["bed", "var(--s3)", "Shelter Hotline", "Shelter beds and warming centers", "4439849540", "443-984-9540"], ["moon", "#6b4c9a", "Winter Shelter Hotline", "9 pm to midnight in winter", "4436957378", "443-695-7378"], ["bolt", "var(--accent)", "Heating bill help", "Community Action Partnership", "4103965555", "410-396-5555"]];
    U.$("#helpStatus").innerHTML = MORE.waterBars() + codeStatus();
    if (!helpShow.wired) { helpShow.wired = true; F("city").on(() => { if (APP.view === "help") U.$("#helpStatus").innerHTML = MORE.waterBars() + codeStatus(); }); }
    U.$("#helpNeighbor").innerHTML = MORE.neighborCard(LIVE.cityAlert("blue") || s === "winter" ? "cold" : LIVE.cityAlert("red") || s === "summer" ? "heat" : "help");
    U.$("#helpCalls").innerHTML = calls.map(([ic, col, t, d, tel, show, urgent]) => `<div class="callrow${urgent ? " urgent" : ""}">${tile(ic, col)}<div><b>${t}</b><small>${d}</small><span class="numtxt tnum">${show}</span></div><a class="round call${urgent ? " urgent" : ""}" href="tel:${tel}" aria-label="Call ${t} at ${show}" title="Call ${show}">${I("phone", 22)}</a></div>`).join("");
    U.$("#helpCalls").classList.add("stagger");
    const here = userLoc ? [userLoc.lon, userLoc.lat] : [LIVE.CENTER[1], LIVE.CENTER[0]];
    U.$("#helpPlacesTitle").textContent = userLoc ? "Places near " + (userLoc.label || "you").split(",")[0] : "Places near downtown";
    const cool = C.cooling.map(x => ({ ...x, kind: "cool" })), warm = W.sites.filter(x => x.lat != null).map(x => ({ ...x, kind: "warm" }));
    const wk = new Set(warm.map(x => addrKey(x.address)));
    const list = (s === "summer" ? cool : s === "winter" ? warm : [...warm.filter(x => x.type === "Warming center"), ...cool.filter(x => !wk.has(addrKey(x.address)))]).map(x => ({ ...x, d: U.km(here, [x.lon, x.lat]) })).sort((a, b) => a.d - b.d).slice(0, 8);
    U.$("#helpPlacesSub").textContent = s === "winter" ? "Warming centers and shelters, closest first." : s === "summer" ? "Cooling centers, closest first." : "Warming and cooling centers, closest first.";
    U.$("#helpPlaces").innerHTML = list.slice(0, 4).map(placeCard).join("") + (list.length > 4 ? `<div class="more-places" hidden>${list.slice(4).map(placeCard).join("")}</div><button class="btn small alt showmore" data-more>Show ${list.length - 4} more places</button>` : "") + `<p class="note">Centers open only when the city activates them. Call 311 to check. For overnight shelters, call the Shelter Hotline first.</p>`;
    U.$("[data-near]").onclick = e => { e.preventDefault(); navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { userLoc = { lat: p.coords.latitude, lon: p.coords.longitude, label: "your location" }; U.store.set("loc", userLoc); helpShow(); }, () => U.toast("Location is off. Search your address on My block instead.")); };
    U.$("[data-more]")?.addEventListener("click", e => { U.$(".more-places").hidden = false; e.currentTarget.remove(); });
    U.$("#helpWaterNotices").innerHTML = MORE.waterBars() || `<p class="note">No boil-water advisories or water main notices from Public Works right now.</p>`;
    U.$("#glossary").innerHTML = MORE.glossary();
    U.$("#helpRights").innerHTML = rights();
    const mo = new Date().getMonth() + 1; if (mo >= 10 || mo <= 4) U.$("#helpRights").insertAdjacentHTML("beforeend", MORE.report("heat"));
    MORE.foodSection(U.$("#helpFood"), here[1], here[0]); MORE.harborSection(U.$("#helpHarbor"));
    const P = [["tree", "var(--s0)", "TreeBaltimore", "A free street tree, planted and watered for you.", "https://www.treebaltimore.org"],
      ["bolt", "var(--accent)", "Energy bill help (OHEP)", "Help with electric and gas bills and past-due balances.", "https://dhs.maryland.gov/office-of-home-energy-programs/"],
      ["hospital", "var(--s4)", "Baltimore City Health Department", "Code Red heat and Code Blue cold alerts, clinics.", "https://health.baltimorecity.gov"],
      ["bed", "var(--s3)", "Winter shelter updates", "When winter shelters open, from the Mayor's Office of Homeless Services.", "https://www.baltimorecity.gov/homeless/winter-shelter"],
      ["waves", "var(--link)", "FEMA flood maps", "The official flood map for any address.", "https://msc.fema.gov/portal/home"],
      ["bus", "#6b4c9a", "Maryland Transit", "Buses, Light RailLink, Metro and MARC trip planner.", "https://www.mta.maryland.gov"],
      ["doc", "var(--ink-2)", "Report a problem (311)", "Street flooding, empty tree pits, dumping, no heat.", "https://311.baltimorecity.gov"]];
    U.$("#helpPrograms").innerHTML = P.map(([ic, col, t, d, u]) => `<div class="place">${tile(ic, col)}<div><b>${t}</b><small>${d}</small></div><div class="go"><a class="round link" href="${u}" target="_blank" rel="noopener" aria-label="Open ${t} website" title="Open website">${I("ext", 18)}</a></div></div>`).join("");
  }

  return { views: {
    today: { show: homeShow, unit: () => { drawHome(); DETAILS.redraw(); } },
    place: { init: placeInit, show: placeShow },
    map: { init: mapInit, reload() { shade.clearLayers(); shade.addData(D().tracts); paint(U.$("#mapColor").value); } },
    help: { show: helpShow },
    guide: { show: () => { U.$("#guideList").innerHTML = MORE.guide(); } },
  }, short, aqiNow, level, THEMES, tile };
})();
