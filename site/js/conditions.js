/* Researcher mode: detailed live conditions, detailed area report, full layers map */
const COND = (() => {
  const D = () => APP.data;
  let userLoc = U.store.get("loc", null);
  const short = n => String(n || "").replace(/,?\s*MD\.?$/i, "").replace(/\s+AT BALTIMORE$/i, "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(At|Near|Nr|Of|To)\b/g, w => w.toLowerCase()).replace(/\bBlvd\b/, "Blvd.").replace(/\bAve\b/, "Ave.");
  const F = id => LIVE.feeds[id];
  const hostRefresh = (root, id) => { const h = U.$(".refresh-host", root); if (h) h.innerHTML = FX.refreshBadge(id); };

  // Official EPA monitor within 25 km wins; the CAMS model is the fallback
  function aqiNow() {
    const m = (F("airnow").value || []).find(x => x.km < 25), AQ = F("air").value;
    return m ? { aqi: m.aqi, site: m.name, km: m.km, time: m.time, mon: m } : { aqi: AQ?.current.us_aqi ?? null, site: null };
  }
  // ======================= TODAY =======================
  function verdictOf(W, AQ, AL) {
    const c = W?.current; const fc = c ? LIVE.feelsCat(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m) : null;
    const aqi = aqiNow().aqi, ac = LIVE.aqiCat(aqi);
    const severe = (AL || []).some(x => /Extreme|Severe/.test(x.severity));
    const lvl = Math.max(fc?.lvl || 0, Math.min(4, ac.lvl), severe ? 3 : (AL && AL.length ? 1 : 0));
    const V = ["Good conditions to be outside", "Mostly fine — take simple precautions", "Take it easy outside", "Limit time outdoors", "Dangerous conditions — stay safe"][Math.min(lvl, 4)];
    const why = [];
    if (fc && fc.kind === "heat" && fc.lvl > 0) why.push(`The heat index is ${U.tF(fc.index)} (${fc.t.toLowerCase()}). Drink water, rest in shade and check on older neighbors.`);
    if (fc && fc.kind === "cold" && fc.lvl > 0) why.push(`Wind chill is ${U.tF(fc.index)}. ${fc.lvl >= 2 ? "Winter shelters open at 32°F wind chill — call 311 or the Shelter Hotline 443-984-9540." : "Dress in layers."}`);
    if (ac.lvl > 0) why.push(`Air quality is ${ac.t.toLowerCase()} (AQI ${aqi}). ${ac.tip}`);
    if (AL && AL.length) why.push(`${AL.length} active weather alert${AL.length > 1 ? "s" : ""}: ${AL.map(a => a.event).join(", ")}.`);
    if (!why.length && c) why.push(`${LIVE.WMO[c.weather_code] || "Calm"} with air quality ${ac.t.toLowerCase()}. ${c.temperature_2m < 50 ? "A jacket helps." : "Enjoy the day."}`);
    return { V, why: why.join(" "), lvl, fc, aqi };
  }
  function drawSky() {
    const W = F("weather").value, AQ = F("air").value, AL = F("alerts").value;
    U.$("#nowTime").textContent = new Date().toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
    const card = U.$("#skyCard");
    if (!W && !AQ) { if (F("weather").err) { U.$("#verdict").textContent = "Live conditions are reconnecting"; U.$("#verdictText").textContent = "The weather service didn't answer. This page retries automatically every few minutes."; } return; }
    const v = verdictOf(W, AQ, AL);
    U.$("#verdict").textContent = v.V; U.$("#verdictText").textContent = v.why;
    if (W) {
      const c = W.current, kind = LIVE.sky(c.weather_code), day = !!c.is_day, hot = v.fc && v.fc.kind === "heat" && v.fc.lvl >= 2;
      const cls = `dsky ${day ? "day" : "night"} ${kind === "fog" ? "cloudy" : kind}${hot ? " hot" : ""}`;
      if (card.className !== cls) { card.className = cls; U.$("#skyScene").innerHTML = FX.scene(kind, day, hot); }
      const stats = [[c.temperature_2m, "t", LIVE.WMO[c.weather_code] || "Now"], [v.fc ? v.fc.index : c.apparent_temperature, "t", v.fc ? v.fc.label : "Feels like"],
        [c.relative_humidity_2m, "%", "Humidity"], [c.wind_speed_10m, "w", `Wind${c.wind_gusts_10m ? ", gusts " + Math.round(c.wind_gusts_10m) : ""}`], [v.aqi == null ? null : Math.round(v.aqi), "n", aqiNow().site ? "Air quality (EPA monitor)" : "Air quality index"]];
      const box = U.$("#nowStats");
      if (!box.children.length) box.innerHTML = stats.map((_, i) => `<div><b class="countup" data-i="${i}">—</b><span></span></div>`).join("");
      stats.forEach(([val, kindv, lab], i) => {
        const b = box.children[i].querySelector("b"), sp = box.children[i].querySelector("span"); sp.textContent = lab;
        if (val == null) { b.textContent = "—"; return; }
        if (kindv === "t") { const x = U.unit() === "F" ? val : U.fToC(val); FX.countUp(b, x, { suffix: "°" }); }
        else FX.countUp(b, val, { suffix: kindv === "%" ? "%" : kindv === "w" ? " mph" : "" });
      });
    }
  }
  function drawAlerts(AL) {
    const el = U.$("#alertsCard");
    if (AL == null) { el.className = "card"; el.innerHTML = `<div class="kicker">Weather alerts ${FX.refreshBadge("alerts")}</div><p class="muted">Reconnecting to the National Weather Service… or check <a href="https://www.weather.gov/lwx/" target="_blank" rel="noopener">weather.gov</a>.</p>`; return; }
    if (!AL.length) { el.className = "card ok"; el.innerHTML = `<div class="kicker">Weather alerts ${FX.refreshBadge("alerts")}</div><h3>No active alerts</h3><p class="muted" style="margin:0">No watches, warnings or advisories for Baltimore right now.</p>`; return; }
    el.className = "card alert pulse";
    el.innerHTML = `<div class="kicker">Weather alerts · NWS ${FX.refreshBadge("alerts")}</div>` + AL.slice(0, 3).map(x => `<h3>${U.esc(x.event)}</h3><p>${U.esc(x.headline || "")}</p>
      <details><summary>Details${x.ends || x.expires ? " · until " + new Date(x.ends || x.expires).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : ""}</summary><p>${U.esc(x.description || "").replace(/\n/g, "<br>")}</p>${x.instruction ? `<p><b>What to do:</b> ${U.esc(x.instruction)}</p>` : ""}</details>`).join("<hr style='border:0;border-top:1px solid var(--line)'>");
  }
  function drawSeason() {
    const s = LIVE.season(), W = D().centers.winter, el = U.$("#seasonCard");
    const start = new Date(W.season.start + "T00:00"), days = Math.ceil((start - new Date()) / 864e5);
    if (s === "winter") el.innerHTML = `<div class="kicker">Winter shelter season</div><h3>Warming centers open on cold days</h3><p class="muted" style="font-size:.9rem">${U.esc(W.activation)}</p><a class="btn alt" href="#help">Nearest warming centers →</a>`;
    else if (s === "summer") el.innerHTML = `<div class="kicker">Summer heat season</div><h3>Cooling centers open on Code Red days</h3><p class="muted" style="font-size:.9rem">Baltimore opens cooling centers when the Health Department declares a Code Red Extreme Heat alert. Call 311 to confirm hours.</p><a class="btn alt" href="#help">Nearest cooling centers →</a>`;
    else el.innerHTML = `<div class="kicker">Between seasons</div><h3>${days > 0 ? `Winter shelter season starts in <span class="countup" id="seasonDays">${days}</span> days` : "Heat season is winding down"}</h3><p class="muted" style="font-size:.9rem">${days > 0 ? `From ${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} warming centers open whenever wind chill reaches 32°F or below.` : ""} Cold now? Call 311 or the Shelter Hotline 443-984-9540.</p><a class="btn alt" href="#help">Help &amp; centers →</a>`;
    const sd = U.$("#seasonDays"); if (sd) FX.countUp(sd, days);
  }
  const AQI_SEGS = [[50, "#2e9a5e"], [100, "#d9a80f"], [150, "#e07b2a"], [200, "#c9402f"], [300, "#8f3f97"]];
  function drawAir() {
    const AQ = F("air").value, mons = F("airnow").value, el = U.$("#airCard");
    if (!AQ && !mons) { if (F("air").err) el.innerHTML = `<div class="kicker">Air quality ${FX.refreshBadge("air")}</div><p class="muted">Air-quality feeds are reconnecting.</p>`; return; }
    const now = aqiNow(), near = now.mon || null;
    const aqi = now.aqi, ac = LIVE.aqiCat(aqi);
    el.innerHTML = `<div class="kicker">Air quality ${FX.refreshBadge(near ? "airnow" : "air")}</div><div class="gwrap"></div>
      <p style="text-align:center;margin:0 0 6px"><span class="pill"><span class="dot" style="background:${ac.c}"></span>${ac.t}</span></p>
      <p class="muted" style="font-size:.9rem">${ac.tip || ""}</p>
      ${near ? `<div style="font-size:.82rem;margin-bottom:6px">Monitor readings: ${Object.entries(near.readings).map(([p, r]) => `${U.esc(p)} <b>${Math.round(r.aqi)}</b>`).join(" · ")}</div>` : ""}
      ${AQ ? `<div class="kicker" style="margin:8px 0 2px">Model forecast by pollutant (AQI)</div><div style="font-size:.82rem">${[["PM2.5", AQ.current.us_aqi_pm2_5], ["Ozone", AQ.current.us_aqi_ozone], ["NO₂", AQ.current.us_aqi_nitrogen_dioxide]].map(([n, v]) => v == null ? "" : `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:46px">${n}</span><div class="meter" style="flex:1;margin:0"><i style="background:${LIVE.aqiCat(v).c}" data-w="${Math.min(100, v / 2)}"></i></div><span style="width:28px;text-align:right">${Math.round(v)}</span></div>`).join("")}</div>` : ""}
      <p class="note">${near ? `Gauge shows the official EPA monitor <b>${U.esc(near.name)}</b> (${U.dist(near.km)} away${near.time ? ", reading " + U.timeAgo(near.time) : ""}). ` : "Gauge shows the model estimate (no EPA monitor reporting nearby). "}Model: Copernicus CAMS via Open-Meteo. <a href="https://www.airnow.gov/?city=Baltimore&state=MD&country=USA" target="_blank" rel="noopener">AirNow</a></p>`;
    const g = FX.gauge({ min: 0, max: 300, segs: AQI_SEGS, label: "US AQI" }); el.querySelector(".gwrap").appendChild(g);
    FX.onReveal(el, () => { g.set(aqi); U.$$(".meter i", el).forEach(i => requestAnimationFrame(() => requestAnimationFrame(() => i.style.width = i.dataset.w + "%"))); });
  }
  function drawFeel() {
    const W = F("weather").value, el = U.$("#feelCard"); if (!W) return;
    const c = W.current, fc = LIVE.feelsCat(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m);
    const nxt = W.hourly; const i0 = curHour(nxt);
    const peak = Math.max(...nxt.temperature_2m.slice(i0, i0 + 24).map((t, k) => U.heatIndex(t, nxt.relative_humidity_2m[i0 + k]) ?? t));
    const low = Math.min(...nxt.temperature_2m.slice(i0, i0 + 24).map((t, k) => U.windChill(t, nxt.wind_speed_10m[i0 + k]) ?? t));
    el.innerHTML = `<div class="kicker">Heat &amp; cold ${FX.refreshBadge("weather")}</div>
      <div style="display:flex;gap:14px;align-items:center">${FX.thermo(fc.index, { color: fc.c, label: fc.label })}
      <div><div class="kicker" style="margin:0">${fc.label}</div><div class="big" style="color:${fc.c}"><span class="countup" id="feelNum">—</span></div>
      <span class="pill"><span class="dot" style="background:${fc.c}"></span>${U.esc(fc.t)}</span></div></div>
      <p class="note">Next 24 h: ${fc.kind === "cold" || low < 40 ? `coldest wind chill <b>${U.tF(low)}</b>` : `peak heat index <b>${U.tF(peak)}</b>`}. Categories follow the National Weather Service heat index and wind-chill scales; Baltimore's Code Blue applies at a wind chill of 13°F or below.</p>`;
    FX.onReveal(el, () => { FX.growThermo(el); FX.countUp(U.$("#feelNum"), U.unit() === "F" ? fc.index : U.fToC(fc.index), { suffix: "°" }); });
  }
  function drawUV() {
    const W = F("weather").value, el = U.$("#uvCard"); if (!W) return;
    const i = curHour(W.hourly), uvNow = W.hourly.uv_index[i], uvMax = W.daily.uv_index_max[0], uc = LIVE.uvCat(uvMax);
    const kwh = W.daily.shortwave_radiation_sum[0] / 3.6, rise = new Date(W.daily.sunrise[0]), set = new Date(W.daily.sunset[0]);
    const t = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    el.innerHTML = `<div class="kicker">Sun, UV &amp; solar ${FX.refreshBadge("weather")}</div><div class="gwrap"></div>
      <p style="text-align:center;margin:0 0 4px"><span class="pill"><span class="dot" style="background:${uc.c}"></span>Peak UV ${uc.t}</span> <small class="muted">now ${Math.round(uvNow ?? 0)}</small></p>
      ${FX.sunPath(rise, set)}<div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--ink-2)"><span>☀ ${t(rise)}</span><span>${t(set)} ☾</span></div>
      <p class="note">${uc.tip} Solar energy today ≈ <b>${kwh.toFixed(1)} kWh/m²</b>, ${kwh >= 5 ? "an excellent" : kwh >= 3 ? "a good" : kwh >= 1.5 ? "a fair" : "a weak"} day for rooftop solar.</p>`;
    const g = FX.gauge({ min: 0, max: 12, segs: [[3, "#2e9a5e"], [6, "#d9a80f"], [8, "#e07b2a"], [11, "#c9402f"], [12, "#8f3f97"]], label: "Peak UV index" });
    el.querySelector(".gwrap").appendChild(g); FX.onReveal(el, () => { g.set(uvMax); FX.moveSun(el); });
  }
  function curHour(h) { const now = Date.now(); let i = h.time.findIndex(t => new Date(t).getTime() > now); return Math.max(0, (i < 0 ? h.time.length : i) - 1); }
  function drawHours() {
    const W = F("weather").value; if (!W) return; const AH = F("air").value?.hourly, H = W.hourly, i = curHour(H);
    const idx = Array.from({ length: Math.min(24, H.time.length - i) }, (_, k) => i + k);
    const feel = k => { const T = H.temperature_2m[k]; return T >= 80 ? U.heatIndex(T, H.relative_humidity_2m[k]) : T <= 50 ? U.windChill(T, H.wind_speed_10m[k]) : T; };
    const vals = idx.map(feel), lo = Math.min(...vals), hi = Math.max(...vals);
    U.$("#hours").innerHTML = idx.map((k, j) => {
      const ai = AH ? AH.time.indexOf(H.time[k]) : -1, av = ai >= 0 ? AH.us_aqi[ai] : null, f = vals[j], fc = LIVE.feelsCat(H.temperature_2m[k], H.relative_humidity_2m[k], H.wind_speed_10m[k]);
      const h = 10 + 34 * (hi > lo ? (f - lo) / (hi - lo) : .5);
      return `<div class="dhour" title="${LIVE.WMO[H.weather_code[k]] || ""}"><span>${j === 0 ? "Now" : new Date(H.time[k]).toLocaleTimeString("en-US", { hour: "numeric" })}</span>
        <div>${FX.icon(H.weather_code[k], H.is_day[k])}</div><b style="color:${fc.lvl ? fc.c : "inherit"}">${U.tF(f)}</b>
        <div class="bar"><i style="background:${fc.lvl ? fc.c : "var(--sky)"}" data-h="${h}"></i></div>
        <span>💧${H.precipitation_probability[k] ?? 0}%</span><br>${av != null ? `<span class="dot" style="background:${LIVE.aqiCat(av).c}" title="AQI ${Math.round(av)}"></span> ${Math.round(av)}` : ""}</div>`;
    }).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => U.$$("#hours .bar i").forEach(b => b.style.height = b.dataset.h + "px")));
  }
  function drawDays() {
    const W = F("weather").value; if (!W) return; const d = W.daily, lo = Math.min(...d.temperature_2m_min), hi = Math.max(...d.temperature_2m_max);
    U.$("#days").innerHTML = d.time.map((t, k) => {
      const a = (d.temperature_2m_min[k] - lo) / (hi - lo || 1) * 100, b = (d.temperature_2m_max[k] - lo) / (hi - lo || 1) * 100;
      return `<div class="day rv"><b>${k === 0 ? "Today" : new Date(t + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</b>${FX.icon(d.weather_code[k], 1, 26)}
        <span class="muted" style="text-align:right">${U.tF(d.temperature_2m_min[k])}</span><div class="range"><i style="left:${a}%;width:${b - a}%"></i></div><span>${U.tF(d.temperature_2m_max[k])}</span><span class="muted" style="font-size:.8rem">💧${d.precipitation_probability_max[k] ?? 0}%</span></div>`;
    }).join("");
    FX.reveal(U.$("#days"));
  }
  function drawWater(sites) {
    const el = U.$("#waterCard");
    if (!sites) { el.innerHTML = `<div class="kicker">Streams &amp; rivers ${FX.refreshBadge("water")}</div><p class="muted">USGS water data is reconnecting.</p>`; return; }
    const flows = sites.filter(s => s.readings["00060"]).sort((a, b) => b.readings["00060"].value - a.readings["00060"].value);
    el.innerHTML = `<div class="kicker">Streams &amp; rivers · USGS ${FX.refreshBadge("water")}</div>
      <svg class="wave" viewBox="0 0 240 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 18 q15 -10 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V36 H0Z" fill="color-mix(in srgb,var(--sky) 30%,transparent)"/><path style="animation-duration:6s" d="M0 22 q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V36 H0Z" fill="color-mix(in srgb,var(--sky) 45%,transparent)"/></svg>
      <div class="big"><span class="countup" id="gaugeN">${sites.length}</span><small> gauges reporting</small></div>
      <ul class="list" style="font-size:.88rem">${flows.slice(0, 4).map(s => `<li>${U.esc(short(s.name))}<span class="meta">${U.fmt(s.readings["00060"].value, 0)} ft³/s${s.readings["00065"] ? " · " + U.fmt(s.readings["00065"].value, 1) + " ft" : ""}</span></li>`).join("")}</ul>
      <p class="note"><a href="#live">All gauges</a> · <a href="#layers">See on map</a></p>`;
    FX.onReveal(el, () => FX.countUp(U.$("#gaugeN"), sites.length));
  }
  let todayWired = false;
  function todayInit() {
    hostRefresh(U.$("#skyCard"), "weather"); hostRefresh(U.$("#v-conditions .card:not([id])"), "weather");
  }
  function todayShow() {
    drawSeason();
    if (todayWired) { redrawToday(); return; } todayWired = true;
    F("weather").on(() => { drawSky(); drawFeel(); drawUV(); drawHours(); drawDays(); });
    F("air").on(() => { drawSky(); drawAir(); drawHours(); });
    F("airnow").on(() => drawAir());
    F("alerts").on(al => { drawAlerts(al); drawSky(); });
    F("water").on(s => drawWater(s));
    setInterval(() => { if (APP.view === "conditions") U.$("#nowTime").textContent = new Date().toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" }); }, 30000);
  }
  function redrawToday() { drawSky(); drawFeel(); drawUV(); drawHours(); drawDays(); drawAir(); drawAlerts(F("alerts").value); drawWater(F("water").value); }

  // ======================= PICK / ROUTE =======================
  let pending = null;
  function pick(lat, lon, label, err) {
    if (err) return msg(err);
    const id = APP.tractAt(lat, lon);
    if (!id) return msg("That spot is outside Baltimore City, which is what this app covers.");
    userLoc = { lat, lon, label: label || "Selected spot" }; U.store.set("loc", userLoc); pending = userLoc;
    if (location.hash === "#report/" + id) placeShow([id]); else location.hash = "report/" + id;
  }
  function msg(t) { if (!location.hash.startsWith("#report")) location.hash = "report"; setTimeout(() => { const m = U.$("#placeMsg"); m.textContent = t; m.style.color = "var(--brick)"; }, 60); }

  // ======================= MY NEIGHBORHOOD =======================
  const TIPS = {
    heat: ["Know your nearest cooling center (listed below) and when it's open; call 311 on Code Red days.", "Close blinds by day and open windows at night when it's cooler outside. Fans alone don't prevent heat illness once it's in the mid-90s °F.", "Check on older neighbors and anyone living alone twice a day during heat waves.", "Ask about free fans or AC units through <a href='https://211md.org' target='_blank' rel='noopener'>211 Maryland</a>."],
    trees: ["Request a free street tree from <a href='https://www.treebaltimore.org' target='_blank' rel='noopener'>TreeBaltimore</a>. Baltimore's young street trees measurably cool their blocks within about a decade.", "Water young street trees weekly in summer (about 15–20 gallons).", "Report dead or hazardous trees and empty tree pits to <a href='https://311.baltimorecity.gov' target='_blank' rel='noopener'>Baltimore 311</a>."],
    health: ["Check the air-quality gauge on the Today page before exercising outside, especially with asthma or COPD.", "Some medicines raise the risk of heat illness. Ask your pharmacist, and keep inhalers and insulin out of the heat.", "Find clinics and Code Red/Code Blue alerts through the <a href='https://health.baltimorecity.gov' target='_blank' rel='noopener'>Baltimore City Health Department</a>."],
    social: ["211 Maryland connects people to food, housing, utility and health help. Dial 2-1-1 or visit <a href='https://211md.org' target='_blank' rel='noopener'>211md.org</a>.", "Set up check-ins for neighbors who live alone on extreme heat and cold days."],
    energy: ["Apply for bill help through the <a href='https://dhs.maryland.gov/office-of-home-energy-programs/' target='_blank' rel='noopener'>Maryland Office of Home Energy Programs</a>, or call Community Action Partnership at 410-396-5555.", "Ask about free weatherization for older homes. It cuts both bills and indoor heat.", "Got a shut-off notice? Call your utility and 2-1-1 right away. A medical certification can delay a shut-off."],
    mobility: ["Plan trips on MTA buses, Light RailLink, Metro SubwayLink and the free Charm City Circulator at <a href='https://www.mta.maryland.gov' target='_blank' rel='noopener'>mta.maryland.gov</a>.", "Turn on the bike lanes, rail stations and farmers markets layers on the Map tab."],
  };
  const THEME_COLORS = { heat: "#c4512f", trees: "#2e7a58", health: "#6b4c9a", social: "#2f7fb5", energy: "#d39a12", mobility: "#4a7f8c" };
  let placeMap, placeLayer, placeMarker;
  function placeInit() {
    APP.searchForm(U.$("#v-report form[data-geo]"), pick);
    placeMap = APP.makeMap("placeMap", { zoom: 12, scroll: false });
    placeLayer = L.geoJSON(D().tracts, { style: f => f.properties.nonres ? APP.NONRES_STYLE : { color: "#8a7f70", weight: .6, fillOpacity: .05, fillColor: "#999" } }).addTo(placeMap);
    placeMap.on("click", e => pick(e.latlng.lat, e.latlng.lng, "Map point " + e.latlng.lat.toFixed(4) + ", " + e.latlng.lng.toFixed(4)));
  }
  function centersNear(lat, lon, n = 3) {
    const s = LIVE.season(), C = D().centers, here = [lon, lat];
    let list = [];
    if (s !== "winter") list = list.concat(C.cooling.map(x => ({ ...x, kind: "cool" })));
    if (s !== "summer") list = list.concat(C.winter.sites.filter(x => x.lat != null && x.type === "Warming center").map(x => ({ ...x, kind: "warm" })));
    list = list.map(x => ({ ...x, d: U.km(here, [x.lon, x.lat]) })).sort((a, b) => a.d - b.d);
    if (s === "shoulder") return [...list.filter(x => x.kind === "warm").slice(0, 2), ...list.filter(x => x.kind === "cool").slice(0, 2)];
    return list.slice(0, n);
  }
  const centerLi = x => `<li><span class="dot" style="background:${x.kind === "warm" ? "#d0672b" : "#2f7fb5"};margin-top:6px"></span><div><b>${U.esc(x.name)}</b><br><small class="muted">${U.esc(x.address)}${x.hours ? " · " + U.esc(x.hours) : ""}${x.serves && x.serves !== "All" ? " · " + U.esc(x.serves) : ""}</small><br><span class="chip">${x.kind === "warm" ? "Warming center (Nov 15–Mar 15, when activated)" : "Cooling center (Code Red days)"}</span></div><span class="meta">${U.dist(x.d)}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}" target="_blank" rel="noopener">Directions</a></span></li>`;
  async function placeShow([id]) {
    const body = U.$("#placeBody"); const m = U.$("#placeMsg"); m.style.color = "";
    if (!id && userLoc) id = APP.tractAt(userLoc.lat, userLoc.lon);
    if (!id || !D().byId[id]) { body.innerHTML = `<div class="card rv"><h2>Your neighborhood report card</h2><p class="muted">Search an address or click the map to see how a block compares on heat, trees, health, housing, energy and getting around, plus its FEMA flood zone and the nearest help.</p></div>`; FX.reveal(body); return; }
    const f = D().byId[id], p = f.properties, cat = D().catalog, ind = D().ind, meta = D().meta.sources;
    const pt = pending || (userLoc && APP.tractAt(userLoc.lat, userLoc.lon) === id ? userLoc : null); pending = null;
    const c = APP.centroid(f), here = pt ? [pt.lat, pt.lon] : [c[1], c[0]];
    m.textContent = pt && pt.label ? "Showing: " + pt.label : "Click any area on the map to switch.";
    const flood = `<div id="floodBox" class="card" style="box-shadow:none;background:var(--surface-2);margin-top:12px"><div class="kicker">🌊 FEMA flood zone</div><p class="muted" style="margin:0">Checking FEMA flood maps…</p></div>`;
    const cools = centersNear(here[0], here[1]);
    if (p.nonres) {
      body.innerHTML = `<div class="card rv"><div class="kicker">${U.esc(p.name)}</div><h1>${/jail/i.test(p.csa) ? "Baltimore City jail complex" : "Non-residential area"}</h1><p>${U.esc(p.nonres)}. It isn't ranked against residential neighborhoods.</p>${flood}</div>
        <div class="card rv" style="margin-top:16px"><h3>Nearest ${LIVE.season() === "winter" ? "warming" : "cooling"} centers</h3><ul class="list">${cools.map(centerLi).join("")}</ul></div>`;
    } else {
      const rings = cat.themes.map(t => { const v = p["t_" + t.key]; return `<div class="ring" data-t="${t.key}" tabindex="0" role="button" aria-label="${U.esc(t.label)} score ${v == null ? "no data" : Math.round(v)}">${FX.ring(v, THEME_COLORS[t.key])}<b>${v == null ? "—" : Math.round(v)}</b>${U.esc(t.label)}${p["u_" + t.key] ? " ⚠" : ""}</div>`; }).join("");
      const rows = cat.themes.map(t => {
        const v = p["t_" + t.key], b = U.band(v), unc = p["u_" + t.key] || [];
        const inputs = t.inputs.map(k => { const i = ind[k]; const cvf = unc.includes(k);
          return `<li>${U.esc(i.label)}: <b>${U.fmt(p[k], i.decimals, i.unit)}</b>${p[k + "_moe"] != null ? ` <small class="muted">(±${U.fmt(p[k + "_moe"], i.decimals)})</small>` : ""} <span class="muted">· city median ${U.fmt(D().med[k], i.decimals, i.unit)}</span>${cvf ? ' <span class="chip warn" title="Coefficient of variation above 30%">⚠ uncertain estimate</span>' : ""} <span class="chip">${U.esc(i.vintage || "")}</span></li>`; }).join("");
        return `<div class="theme-row" id="th-${t.key}"><div class="hd"><b>${U.esc(t.label)}</b><span class="pill"><span class="dot" style="background:${b.color}"></span>${b.word}</span></div>
          <div class="meter"><i style="background:${THEME_COLORS[t.key]}" data-w="${v ?? 0}"></i></div>
          <small class="muted">${b.label} of Baltimore's residential tracts · score ${v == null ? "—" : Math.round(v)}/100${unc.length ? " · ⚠ includes an uncertain estimate" : ""}</small>
          <details><summary>What's behind this &amp; what you can do</summary><ul>${inputs}</ul><b>What helps</b><ul class="tips">${TIPS[t.key].map(x => `<li>${x}</li>`).join("")}</ul></details></div>`;
      }).join("");
      const holc = p.holc_grade && /[CD]/.test(p.holc_grade) ? `<p class="note">📜 Much of this area was graded "${p.holc_grade}" on the 1937 federal redlining maps. Across Baltimore, formerly redlined areas are hotter today and have far less tree cover.</p>` : "";
      body.innerHTML = `<div class="grid g2">
        <div class="card rv"><div class="kicker">${U.esc(p.name)} · ${U.fmt(p.pop2020, 0)} residents</div><h1>${U.esc(p.csa)}</h1>
          <p>Heat vulnerability: <b>${U.esc(p.hvi_class || "—")}</b>${p.rank_lo90 != null ? ` (ranked between ${Math.round(p.rank_lo90)} and ${Math.round(p.rank_hi90)} of ${D().res.length} tracts; 1 = most vulnerable)` : ""}.</p>
          <p>On summer days the ground here averages <b>${U.tC(p.lst_popw_c)}</b>, cooling to ${U.tC(p.modis_myd_night_c)} at night, with <b>${U.fmt(p.pct_tree, 0)}%</b> tree cover.</p>${holc}${flood}
          <p class="note"><a href="#report/${id}">Link to this report</a> · <a href="#place/${id}">Simple view</a></p></div>
        <div class="card rv"><div class="kicker">Neighborhood report card <span class="chip">100 = most burdened in the city</span></div><div class="rings">${rings}</div>${rows}</div></div>
        <div class="card rv" style="margin-top:16px"><h3>Nearest places to ${LIVE.season() === "winter" ? "warm up" : LIVE.season() === "summer" ? "cool off" : "cool off or warm up"}</h3><ul class="list">${cools.map(centerLi).join("")}</ul><p class="note">Centers open only when the city activates them. Call 311 to confirm, or the Shelter Hotline at 443-984-9540.</p></div>`;
      U.$$(".ring", body).forEach(r => r.onclick = r.onkeydown = e => { if (e.type === "keydown" && e.key !== "Enter") return; const row = U.$("#th-" + r.dataset.t); row.querySelector("details").open = true; row.scrollIntoView({ behavior: "smooth", block: "center" }); U.$$(".ring", body).forEach(x => x.classList.toggle("on", x === r)); });
      const card = U.$(".rings", body).parentElement;
      FX.onReveal(card, () => { FX.growRings(card); U.$$(".meter i", card).forEach(i => requestAnimationFrame(() => requestAnimationFrame(() => i.style.width = i.dataset.w + "%"))); });
    }
    FX.reveal(body);
    U.$$("[data-to-research]").forEach(a => a.onclick = e => { e.preventDefault(); APP.setMode("research"); });
    placeLayer.setStyle(g => g.properties.id === id ? { color: "#b4472f", weight: 3, fillOpacity: .28, fillColor: "#e8a91b" } : g.properties.nonres ? APP.NONRES_STYLE : { color: "#8a7f70", weight: .6, fillOpacity: .05, fillColor: "#999" });
    if (placeMarker) placeMarker.remove();
    if (pt) placeMarker = L.marker([pt.lat, pt.lon]).addTo(placeMap);
    placeMap.invalidateSize(); placeLayer.eachLayer(l => { if (l.feature.properties.id === id) { try { if (FX.reduce) throw 0; placeMap.flyToBounds(l.getBounds(), { maxZoom: 15, padding: [30, 30], duration: .9 }); } catch { placeMap.fitBounds(l.getBounds(), { maxZoom: 15, padding: [30, 30] }); } } });
    LIVE.floodAt(here[0], here[1]).then(r => {
      const box = U.$("#floodBox"); if (!box) return;
      const col = ["var(--marsh)", "var(--gold)", "var(--brick)", "var(--severe)"][r.level];
      box.style.borderLeft = `5px solid ${col}`;
      box.innerHTML = `<div class="kicker">🌊 FEMA flood zone ${pt ? "at this address" : "at the tract center"}</div><b style="font-size:1.15rem">Zone ${U.esc(r.zone)}${r.sfha ? " — high risk" : ""}</b><p class="muted" style="margin:.2em 0 0">${U.esc(r.text)}.${r.bfe ? ` Base flood elevation ${r.bfe} ft.` : ""} ${r.sfha ? "Flood insurance is usually required for buildings with a federally backed mortgage." : "Heavy rain can still flood streets and basements here."} <a href="https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(here[0] + "," + here[1])}" target="_blank" rel="noopener">Official FEMA map</a></p>`;
    }).catch(() => { const box = U.$("#floodBox"); if (box) box.innerHTML = `<div class="kicker">🌊 FEMA flood zone</div><p class="muted" style="margin:0">FEMA's flood map service didn't respond. It's retried each time you open a report, or check the <a href="https://msc.fema.gov/portal/home" target="_blank" rel="noopener">FEMA Map Service Center</a>.</p>`; });
  }

  // ======================= MAP =======================
  let mainMap, choro, overlays = {};
  function mapInit() {
    mainMap = APP.makeMap("layersMap");
    const sel = U.$("#mapTheme");
    sel.innerHTML = D().catalog.themes.map(t => `<option value="t_${t.key}">${U.esc(t.label)} score</option>`).join("") + `<option value="hvi">Heat vulnerability index</option><option value="pct_tree">Tree cover</option><option value="lst_popw_c">Summer surface temperature</option><option value="none">No coloring</option>`;
    sel.onchange = () => paint(sel.value);
    choro = L.geoJSON(D().tracts).addTo(mainMap);
    paint(sel.value);
    mainMap.on("click", e => mapClick(e.latlng));
    U.$("#layerList").innerHTML = Object.entries(LAYERS.DEF).map(([k, d]) => `<label class="chk"><input type="checkbox" data-layer="${k}" ${k === "cool" || k === "warm" ? "checked" : ""}><span class="dot" style="background:${d.color}"></span>${d.label}</label>`).join("");
    U.$$("#layerList input").forEach(i => i.onchange = () => toggle(i.dataset.layer, i.checked, i));
    toggle("cool", true); toggle("warm", true);
  }
  function paint(key) {
    if (key === "none") { choro.setStyle(f => f.properties.nonres ? APP.NONRES_STYLE : { color: "#8a9aa6", weight: .5, fillOpacity: 0 }); if (mainMap._ccpLegend) mainMap.removeControl(mainMap._ccpLegend); mainMap._ccpLegend = null; return; }
    const isT = key.startsWith("t_"), i = D().ind[key], R = i && i.direction < 0 ? U.RAMP_GREEN : U.RAMP;
    const br = isT ? [20, 40, 60, 80] : U.breaks(D().res.map(f => f.properties[key]));
    choro.setStyle(f => { if (f.properties.nonres) return APP.NONRES_STYLE; const k = U.classify(f.properties[key], br); return { color: "#fff", weight: .6, fillOpacity: k < 0 ? .1 : .74, fillColor: k < 0 ? "#bbb" : R[k] }; });
    const lbl = U.$("#mapTheme").selectedOptions[0].textContent;
    const lab = v => i ? U.fmt(v, i.decimals, i.unit) : Math.round(v);
    APP.legend(mainMap, lbl + (isT ? " (100 = most burdened)" : ""), (isT ? [[U.RAMP[4], "80–100"], [U.RAMP[3], "60–80"], [U.RAMP[2], "40–60"], [U.RAMP[1], "20–40"], [U.RAMP[0], "0–20"]]
      : R.map((c, k) => [c, k === 0 ? `≤ ${lab(br[0])}` : k === 4 ? `> ${lab(br[3])}` : `${lab(br[k - 1])} – ${lab(br[k])}`]).reverse()).concat([["#d5dde3", "Non-residential"]]));
  }
  async function mapClick(ll) {
    const id = APP.tractAt(ll.lat, ll.lng);
    const pop = L.popup({ maxWidth: 280 }).setLatLng(ll).setContent("<em>Loading…</em>").openOn(mainMap);
    const p = id ? D().byId[id].properties : null;
    let html = p ? `<h4>${U.esc(p.csa)}</h4><small>${U.esc(p.name)}${p.nonres ? ", " + U.esc(p.nonres) : ", " + U.fmt(p.pop2020, 0) + " residents"}</small><br>` +
      (p.nonres ? "" : D().catalog.themes.map(t => { const v = p["t_" + t.key]; return `${U.esc(t.label)}: <b>${v == null ? "—" : Math.round(v)}</b>`; }).join("<br>")) : "<h4>Outside Baltimore City</h4>";
    html += `<div id="popFlood" style="margin-top:6px">Checking flood zone…</div>${p && !p.nonres ? `<a href="#report/${id}">Full report</a>` : ""}`;
    pop.setContent(html);
    try { const r = await LIVE.floodAt(ll.lat, ll.lng); const el = document.getElementById("popFlood"); if (el) el.innerHTML = `Flood zone <b>${U.esc(r.zone)}</b>${r.sfha ? " (high risk)" : ""}<br><small>${U.esc(r.text)}</small>`; }
    catch { const el = document.getElementById("popFlood"); if (el) el.textContent = "FEMA flood service didn't respond."; }
  }
  async function toggle(k, on, input) {
    const msgEl = U.$("#layerMsg");
    if (!on) { if (overlays[k]) { mainMap.removeLayer(overlays[k]); if (overlays[k]._unsub) { overlays[k]._unsub(); delete overlays[k]; } } return; }
    if (overlays[k]) { overlays[k].addTo(mainMap); return; }
    try { msgEl.textContent = "Loading " + LAYERS.DEF[k].label.toLowerCase() + "…"; overlays[k] = await LAYERS.load(k, { onCount: n => { msgEl.textContent = n == null ? LAYERS.DEF[k].label + " shown." : `${LAYERS.DEF[k].label}: ${n}`; } }); overlays[k].addTo(mainMap); }
    catch (e) { msgEl.textContent = LAYERS.DEF[k].label + " didn't load. Try again in a minute."; if (input) input.checked = false; delete overlays[k]; }
  }

  return { views: {
    conditions: { init: todayInit, show: todayShow, unit: redrawToday },
    report: { init: placeInit, show: placeShow },
    layers: { init: mapInit, unit: () => paint(U.$("#mapTheme").value), reload() { choro.clearLayers(); choro.addData(D().tracts); paint(U.$("#mapTheme").value); } },
  } };
})();
