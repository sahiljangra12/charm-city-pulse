/* "What matters right now": ranks live conditions by urgency so the most important thing is always first.
   Each item: score (0-100), title, text, icon, and one clear action. Levels: Act now (80+), Today (45+), Good to know. */
const PRIO = (() => {
  const F = id => LIVE.feeds[id];
  const hm = d => d.toLocaleTimeString("en-US", { hour: "numeric" });
  const LV = [{ min: 80, key: "now", label: "Act now", c: "var(--s4)" }, { min: 45, key: "today", label: "Today", c: "var(--s3)" }, { min: 0, key: "fyi", label: "Good to know", c: "var(--s0)" }];
  const lv = s => LV.find(l => s >= l.min);
  const daysTo = (m, d) => { const n = new Date(), t = new Date(n.getFullYear(), m - 1, d); if (t < n) t.setFullYear(t.getFullYear() + 1); return Math.ceil((t - n) / 864e5); };

  function build() {
    const W = F("weather").value, AL = F("alerts").value || [], out = [];
    const add = o => out.push(o);
    // 1. Official warnings from the National Weather Service
    AL.forEach((a, i) => {
      const s = /Extreme/.test(a.severity) ? 100 : /Severe/.test(a.severity) ? 92 : /Moderate/.test(a.severity) ? 72 : 55;
      const heat = /heat/i.test(a.event), cold = /cold|chill|freez|winter|snow|ice/i.test(a.event), flood = /flood/i.test(a.event);
      add({ s: s - i, icon: "alert", title: a.event, text: a.headline || "In effect for Baltimore.", more: a.instruction,
        act: heat ? ["Find a cool place", "#help"] : cold ? ["Find a warm place", "#help"] : flood ? ["Check flood risk at my block", "#place"] : null });
    });
    if (W) {
      const H = W.hourly, now = Date.now(); let i0 = H.time.findIndex(t => new Date(t).getTime() > now) - 1; if (i0 < 0) i0 = 0;
      const next = (n) => H.time.slice(i0, i0 + n).map((t, j) => { const k = i0 + j, T = H.temperature_2m[k], RH = H.relative_humidity_2m[k], V = H.wind_speed_10m[k];
        return { t: new Date(t), T, feel: T >= 80 ? U.heatIndex(T, RH) : T <= 50 ? (U.windChill(T, V) ?? T) : T, rain: H.precipitation_probability[k] ?? 0, V, uv: H.uv_index[k] ?? 0, day: H.is_day ? !!H.is_day[k] : true }; });
      const h12 = next(12), h18 = next(18);
      // 2. Heat
      const cw = W.current, curFc = LIVE.feelsCat(cw.temperature_2m, cw.relative_humidity_2m, cw.wind_speed_10m);
      let peak = h12.reduce((a, b) => b.feel > a.feel ? b : a, h12[0]);
      if (curFc && peak && curFc.index >= peak.feel && cw.temperature_2m >= 80) peak = { t: null, T: cw.temperature_2m, feel: curFc.index };
      if (peak && peak.T >= 80) {
        const f = peak.feel;
        if (f >= 103) add({ s: f >= 125 ? 97 : 88, icon: "thermo", title: `Dangerous heat, feels like ${U.tF(f)}`, text: `${peak.t ? "Worst around " + hm(peak.t) : "Right now"}. Stay somewhere air-conditioned, drink water often, and check on older neighbors.`, act: ["Find a cool place", "#help"] });
        else if (f >= 90) add({ s: 62, icon: "thermo", title: `Hot today, feels like ${U.tF(f)}`, text: `${peak.t ? "Hottest around " + hm(peak.t) : "Hottest right now"}. Drink water, rest in the shade, and keep hard work for the morning.`, act: ["Best time to go out", "#plan"] });
        else add({ s: 30, icon: "thermo", title: `Warm, up to ${U.tF(f)}`, text: "Bring water if you'll be outside for a while." });
      }
      // 3. Cold
      const low = h18.reduce((a, b) => b.feel < a.feel ? b : a, h18[0]);
      if (low && low.T <= 50) {
        const f = low.feel;
        if (f <= 13) add({ s: 93, icon: "snow", title: `Code Blue cold, wind chill ${U.tF(f)}`, text: `Coldest around ${hm(low.t)}. Limit time outside. Warming centers and shelters are open.`, act: ["Call the Shelter Hotline", "tel:4439849540"] });
        else if (f <= 32) add({ s: 70, icon: "snow", title: `Freezing, down to ${U.tF(f)}`, text: `Coldest around ${hm(low.t)}. Wear layers, cover hands and ears, and bring pets inside.`, act: LIVE.season() === "winter" ? ["Find a warm place", "#help"] : null });
        else if (f <= 40) add({ s: 36, icon: "snow", title: `Cold, down to ${U.tF(f)}`, text: `Coldest around ${hm(low.t)}. A warm coat helps.` });
      }
      // 4. Rain
      const wet = h12.find(h => h.rain >= 50);
      if (wet) {
        const fl = U.store.get("floodLvl", null), maxR = Math.max(...h12.map(h => h.rain));
        if (fl >= 2 && maxR >= 70) add({ s: 74, icon: "waves", title: "Heavy rain and your block floods", text: `Rain likely from about ${hm(wet.t)}. Move things off basement floors and avoid driving through standing water.`, act: ["Check my block", "#place"] });
        else add({ s: maxR >= 80 ? 52 : 46, icon: "umbrella", title: `Rain likely around ${hm(wet.t)}`, text: `Up to a ${maxR}% chance in the next 12 hours. Bring an umbrella.` });
      }
      // 5. Wind
      const gust = h12.reduce((a, b) => b.V > a.V ? b : a, h12[0]);
      if (gust && gust.V >= 25) add({ s: gust.V >= 35 ? 66 : 42, icon: "wind", title: `Windy, up to ${Math.round(gust.V)} mph`, text: `Strongest around ${hm(gust.t)}. Secure loose items outside.` });
      // 6. Sun
      const uvMax = W.daily.uv_index_max[0];
      if (uvMax >= 6 && h12.some(h => h.day && h.uv >= 6)) add({ s: uvMax >= 8 ? 44 : 26, icon: "sun", title: `${uvMax >= 8 ? "Very strong" : "Strong"} sun, UV ${Math.round(uvMax)}`, text: "Sunscreen, a hat and shade between 10 AM and 4 PM." });
      // 7. Best time to be outside
      try {
        const a = PLAN.ACTS.walk, all = PLAN.scoreHours(W, F("air").value, a), today = new Date().toDateString();
        const tod = all.filter(h => h.t.toDateString() === today), bt = tod.length ? PLAN.bestWindow(tod, 1) : null;
        const useToday = bt && bt.avg >= 65, hs = useToday ? tod : all, b = useToday ? bt : PLAN.bestWindow(all, 1);
        if (b) { const st = hs[b.i].t, e = new Date(st.getTime() + 3600e3);
          add({ s: 24, icon: "walk", title: `Best time for a walk: ${PLAN.dayName(st).toLowerCase() === "today" ? "" : PLAN.dayName(st) + ", "}${hm(st)} to ${hm(e)}`.replace(": ,", ":"), text: "Picked from the forecast for heat, rain, air and daylight.", act: ["Plan another activity", "#plan"] }); }
      } catch {}
    }
    // 8. Air
    const aq = RES.aqiNow().aqi;
    if (aq != null) {
      const c = LIVE.aqiCat(aq);
      if (c.lvl >= 3) add({ s: c.lvl >= 4 ? 90 : 82, icon: "wind", title: `Unhealthy air, AQI ${Math.round(aq)}`, text: c.tip, act: ["See air details", "#today/details"] });
      else if (c.lvl === 2) add({ s: 64, icon: "wind", title: `Air is unhealthy for sensitive groups`, text: c.tip, act: ["Best time to go out", "#plan"] });
      else if (c.lvl === 1) add({ s: 22, icon: "wind", title: `Air is moderate, AQI ${Math.round(aq)}`, text: "Fine for most people. Very sensitive people may want to take it easy." });
      else add({ s: 12, icon: "wind", title: `Clean air, AQI ${Math.round(aq)}`, text: "A good time to open the windows." });
    }
    // 9. Seasonal heads-up
    const toWinter = daysTo(11, 15), toSummer = daysTo(5, 15);
    if (LIVE.season() !== "winter" && toWinter <= 35) add({ s: 16, icon: "flame", title: `Warming centers open in ${toWinter} days`, text: "From November 15, they open whenever the wind chill reaches 32°F or below.", act: ["See places and hotlines", "#help"] });
    if (LIVE.season() !== "summer" && toSummer <= 30) add({ s: 16, icon: "snow", title: `Heat season starts in ${toSummer} days`, text: "Cooling centers open on Code Red heat days.", act: ["See places and hotlines", "#help"] });
    return out.sort((a, b) => b.s - a.s);
  }

  function render() {
    const box = U.$("#hPrio"); if (!box) return;
    const items = build(); if (!items.length) return;
    const top = items.slice(0, 5), urgent = top.filter(x => x.s >= 45).length;
    U.$("#hPrioSub").textContent = urgent ? `${urgent} thing${urgent > 1 ? "s" : ""} to act on, most important first.` : "Nothing urgent right now. Here's what's useful to know.";
    const key = top.map(x => x.title).join("|"); const fresh = box.dataset.k !== key; box.dataset.k = key;
    box.innerHTML = top.map((x, i) => { const l = lv(x.s), href = x.act?.[1];
      return `<article class="prio ${l.key}${i === 0 ? " first" : ""}" style="--c:${l.c}">
        <span class="tile">${I(x.icon, i === 0 ? 26 : 22)}</span>
        <div class="body"><span class="badge">${l.label}</span><h3>${U.esc(x.title)}</h3><p>${U.esc(x.text)}</p>
          ${x.more ? `<details><summary>What to do</summary><p>${U.esc(x.more)}</p></details>` : ""}</div>
        ${x.act ? `<a class="btn ${i === 0 && l.key !== "fyi" ? "" : "alt"} small go" href="${href}">${href.startsWith("tel:") ? I("phone", 16) : ""}<span>${x.act[0]}</span>${href.startsWith("tel:") ? "" : I("chev", 16)}</a>` : ""}
      </article>`; }).join("");
    if (fresh) { box.classList.remove("stagger"); void box.offsetWidth; box.classList.add("stagger"); }
  }
  return { build, render };
})();
