/* "In detail" panels on Today: official air monitor gauge, heat/cold thermometer, UV and sun path, rivers. */
const DETAILS = (() => {
  const F = id => LIVE.feeds[id];
  const S = ["var(--s0)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];
  const AQI_SEGS = [[50, "#1e9e5a"], [100, "#e3a900"], [150, "#ef7d16"], [200, "#d6283b"], [300, "#8f1d4a"]];
  const curHour = h => { const now = Date.now(); let i = h.time.findIndex(t => new Date(t).getTime() > now); return Math.max(0, (i < 0 ? h.time.length : i) - 1); };
  const head = (t, feed) => `<div class="label">${t} ${FX.refreshBadge(feed)}</div>`;
  const open = () => U.$("#detailsBox")?.open;

  function air() {
    const el = U.$("#airCard"); if (!el) return; const AQ = F("air").value, mons = F("airnow").value;
    if (!AQ && !mons) { if (F("air").err) el.innerHTML = head("Air quality", "air") + `<p class="muted">Reconnecting to the air-quality feeds.</p>`; return; }
    const now = RES.aqiNow(), near = now.mon || null, ac = LIVE.aqiCat(now.aqi);
    el.innerHTML = head("Air quality", near ? "airnow" : "air") + `<div class="gwrap"></div>
      <p style="text-align:center;margin:0 0 8px"><span class="pill"><span class="dot" style="background:${ac.c}"></span>${ac.t}</span></p>
      <p class="muted" style="font-size:.92rem">${ac.tip || ""}</p>
      ${near ? `<p style="font-size:.86rem;margin:0 0 8px">Monitor: ${Object.entries(near.readings).map(([p, r]) => `${U.esc(p)} <b class="tnum">${Math.round(r.aqi)}</b>`).join(", ")}</p>` : ""}
      ${AQ ? `<div style="font-size:.84rem">${[["PM2.5", AQ.current.us_aqi_pm2_5], ["Ozone", AQ.current.us_aqi_ozone], ["NO₂", AQ.current.us_aqi_nitrogen_dioxide]].map(([n, v]) => v == null ? "" : `<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="width:48px;color:var(--ink-2)">${n}</span><div class="meter" style="flex:1;margin:0"><i style="background:${LIVE.aqiCat(v).c}" data-w="${Math.min(100, v / 2)}"></i></div><span class="tnum" style="width:28px;text-align:right">${Math.round(v)}</span></div>`).join("")}</div>` : ""}
      <p class="note">${near ? `Gauge: EPA monitor at ${U.esc(near.name)}, ${U.dist(near.km)} away${near.time ? ", " + U.timeAgo(near.time) : ""}. ` : "Gauge: forecast model (no EPA monitor reporting nearby). "}Bars: forecast model by pollutant.</p>`;
    const g = FX.gauge({ min: 0, max: 300, segs: AQI_SEGS, label: "US AQI" }); el.querySelector(".gwrap").appendChild(g);
    setTimeout(() => { g.set(now.aqi); U.$$(".meter i", el).forEach(i => i.style.width = i.dataset.w + "%"); }, 80);
  }
  function feel() {
    const el = U.$("#feelCard"), W = F("weather").value; if (!el || !W) return;
    const c = W.current, fc = LIVE.feelsCat(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m), H = W.hourly, i0 = curHour(H);
    const peak = Math.max(...H.temperature_2m.slice(i0, i0 + 24).map((t, k) => t >= 80 ? U.heatIndex(t, H.relative_humidity_2m[i0 + k]) : t));
    const low = Math.min(...H.temperature_2m.slice(i0, i0 + 24).map((t, k) => U.windChill(t, H.wind_speed_10m[i0 + k]) ?? t));
    el.innerHTML = head("Heat and cold", "weather") + `<div style="display:flex;gap:18px;align-items:center">${FX.thermo(fc.index, { color: fc.c, label: fc.label })}
      <div><div class="muted" style="font-weight:600">${fc.label}</div><div class="big" style="color:${fc.c}"><span id="feelNum">${U.tF(fc.index)}</span></div>
      <span class="pill" style="margin-top:8px"><span class="dot" style="background:${fc.c}"></span>${U.esc(fc.t)}</span></div></div>
      <p class="note">Next 24 hours: ${fc.kind === "cold" || low < 40 ? `coldest wind chill <b>${U.tF(low)}</b>` : `highest heat index <b>${U.tF(peak)}</b>`}. Uses the National Weather Service heat index and wind chill. Baltimore's Code Blue begins at a wind chill of 13°F.</p>`;
    setTimeout(() => FX.growThermo(el), 80);
  }
  function uv() {
    const el = U.$("#uvCard"), W = F("weather").value; if (!el || !W) return;
    const i = curHour(W.hourly), uvNow = W.hourly.uv_index[i], uvMax = W.daily.uv_index_max[0], uc = LIVE.uvCat(uvMax);
    const kwh = W.daily.shortwave_radiation_sum[0] / 3.6, rise = new Date(W.daily.sunrise[0]), set = new Date(W.daily.sunset[0]);
    const t = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    el.innerHTML = head("Sun, UV and solar", "weather") + `<div class="gwrap"></div>
      <p style="text-align:center;margin:0 0 4px"><span class="pill"><span class="dot" style="background:${uc.c}"></span>Peak UV: ${uc.t}</span> <small class="muted">now ${Math.round(uvNow ?? 0)}</small></p>
      ${FX.sunPath(rise, set)}<div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--ink-2)"><span>Sunrise ${t(rise)}</span><span>Sunset ${t(set)}</span></div>
      <p class="note">${uc.tip} Solar energy today is about <b>${kwh.toFixed(1)} kWh/m²</b>, ${kwh >= 5 ? "an excellent" : kwh >= 3 ? "a good" : kwh >= 1.5 ? "a fair" : "a weak"} day for rooftop solar.</p>`;
    const g = FX.gauge({ min: 0, max: 12, segs: [[3, "#1e9e5a"], [6, "#e3a900"], [8, "#ef7d16"], [11, "#d6283b"], [12, "#8f1d4a"]], label: "Peak UV index" });
    el.querySelector(".gwrap").appendChild(g); setTimeout(() => { g.set(uvMax); FX.moveSun(el); }, 80);
  }
  function water(sites) {
    const el = U.$("#waterCard"); if (!el) return;
    if (!sites) { el.innerHTML = head("Streams and rivers", "water") + `<p class="muted">Reconnecting to USGS.</p>`; return; }
    const flows = sites.filter(s => s.readings["00060"]).sort((a, b) => b.readings["00060"].value - a.readings["00060"].value);
    el.innerHTML = head("Streams and rivers", "water") + `<svg class="wave" viewBox="0 0 240 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 18 q15 -10 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V36 H0Z" fill="color-mix(in srgb,var(--link) 22%,transparent)"/><path style="animation-duration:6s" d="M0 22 q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V36 H0Z" fill="color-mix(in srgb,var(--link) 38%,transparent)"/></svg>
      <div class="big tnum">${sites.length}<small> USGS gauges reporting</small></div>
      <ul class="list" style="font-size:.9rem">${flows.slice(0, 4).map(s => `<li>${U.esc(RES.short(s.name))}<span class="meta tnum">${U.fmt(s.readings["00060"].value, 0)} ft³/s${s.readings["00065"] ? ", " + U.fmt(s.readings["00065"].value, 1) + " ft" : ""}</span></li>`).join("")}</ul>
      <p class="note"><a href="#live">All gauges</a></p>`;
  }
  const all = () => { if (!open()) return; air(); feel(); uv(); water(F("water").value); };
  let wired = false;
  function init() {
    const box = U.$("#detailsBox"); if (!box) return;
    U.$("#detailsIcon").innerHTML = I("gauge", 20); U.$("#detailsChev").outerHTML = I("chev", 20).replace('class="ic"', 'class="ic chev"');
    box.addEventListener("toggle", () => { if (box.open) { wire(); all(); } });
  }
  function wire() {
    if (wired) return; wired = true;
    F("weather").on(() => { if (open()) { feel(); uv(); } });
    F("air").on(() => open() && air()); F("airnow").on(() => open() && air());
    F("water").on(s => open() && water(s));
  }
  return { init, redraw: all };
})();
