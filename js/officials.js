/* Tools for city and state staff, added to the City brief:
   - By City Council district: population-weighted scores, residents far from help, places per district
   - Equity: neighborhoods where need is high and the nearest center is far
   - What-if: tap the map to test a new warming/cooling center and see who it would bring within a mile
   - Change maps: color the city by how a measure changed over time (BNIA Vital Signs, Heat Atlas)
   - One-page neighborhood brief (#nb/<neighborhood>), printable
   - Methods (#methods) and data API notes (on Download) */
const OFF = (() => {
  const D = () => APP.data;
  const MILE = 1.609;
  const C5 = ["var(--s0)", "var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
  const lvl = v => v == null ? -1 : v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0;
  const bar = v => { const l = lvl(v); return l < 0 ? '<span class="muted">—</span>' : `<span class="bscore"><i style="background:${C5[l]};--w:${Math.max(4, v) * .44}"></i><b>${Math.round(v)}</b></span>`; };
  const THEMES = ["heat", "trees", "health", "social", "energy", "mobility"];
  const TNAME = { heat: "Heat", trees: "Low shade", health: "Health", social: "Social vuln.", energy: "Energy strain", mobility: "Getting around" };
  const priority = p => { const v = ["heat", "trees", "health", "social"].map(k => p["t_" + k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const tracts = () => D().feats.filter(f => !f.properties.nonres).map(f => { const c = APP.centroid(f); return { p: f.properties, lon: c[0], lat: c[1], pop: f.properties.pop2020 || 0 }; });

  function seasonCenters() {
    const s = LIVE.season(), m = new Date().getMonth() + 1, c = D().centers;
    return (s === "winter" || (s === "shoulder" && m >= 9))
      ? { label: "warming centers and shelters", list: (c.winter?.sites || []).filter(x => x.lat != null) }
      : { label: "cooling centers", list: c.cooling || [] };
  }
  const nearestKm = (lat, lon, list) => list.length ? Math.min(...list.map(x => U.km([lon, lat], [x.lon, x.lat]))) : Infinity;

  // ---------------- council districts ----------------
  async function districts(el) {
    let cd, S; try { [cd, S] = await Promise.all([MORE.file("services/council.geojson"), MORE.file("services.json")]); } catch { el.innerHTML = `<p class="note">Council district boundaries are not available in this build.</p>`; return; }
    const cen = seasonCenters(), T = tracts();
    const rows = cd.features.map(f => {
      const ts = T.filter(t => U.inGeom([t.lon, t.lat], f.geometry)), pop = ts.reduce((a, t) => a + t.pop, 0) || 1;
      const w = k => { const v = ts.filter(t => t.p["t_" + k] != null); const W = v.reduce((a, t) => a + t.pop, 0); return W ? v.reduce((a, t) => a + t.p["t_" + k] * t.pop, 0) / W : null; };
      const far = ts.filter(t => nearestKm(t.lat, t.lon, cen.list) > MILE).reduce((a, t) => a + t.pop, 0);
      const count = list => (list || []).filter(x => U.inGeom([x.lon, x.lat], f.geometry)).length;
      const pr = ts.filter(t => priority(t.p) != null), prio = pr.length ? pr.reduce((a, t) => a + priority(t.p) * t.pop, 0) / pr.reduce((a, t) => a + t.pop, 0) : null;
      return { d: f.properties.district, member: f.properties.member, pop, prio, w, far, centers: count(cen.list), libs: count(S.libraries), seniors: count(S.seniors), tracts: ts.length };
    });
    rowsD = rows;
    el.innerHTML = `<div class="tablewrap"><table class="btable"><thead><tr><th class="num">District</th><th>Council member</th><th class="num">Residents</th><th>Priority</th>${THEMES.slice(0, 4).map(k => `<th>${TNAME[k]}</th>`).join("")}<th class="num">Over 1 mile from a center</th><th class="num">Centers · libraries · senior centers</th></tr></thead><tbody>` +
      rows.sort((a, b) => (b.prio ?? 0) - (a.prio ?? 0)).map(r => `<tr><td class="num"><b>${r.d}</b></td><td>${U.esc(r.member || "")}</td><td class="num">${Math.round(r.pop).toLocaleString()}</td><td>${bar(r.prio)}</td>${THEMES.slice(0, 4).map(k => `<td>${bar(r.w(k))}</td>`).join("")}<td class="num">${Math.round(r.far).toLocaleString()} <small class="muted">(${Math.round(100 * r.far / r.pop)}%)</small></td><td class="num">${r.centers} · ${r.libs} · ${r.seniors}</td></tr>`).join("") + `</tbody></table></div>
      <p class="note">Scores are population-weighted averages of the census tracts whose center falls in each district (2020 population). Sorted by overall priority. "Centers" are the ${cen.label} open this season. District boundaries: Baltimore City Department of Transportation GIS.</p>`;
  }
  let rowsD = [];

  // ---------------- equity: high need, help far ----------------
  function equity(el) {
    const cen = seasonCenters(), by = {};
    tracts().forEach(t => { const b = by[t.p.csa] || (by[t.p.csa] = { x: 0, y: 0, w: 0, far: 0 }); b.x += t.lon * t.pop; b.y += t.lat * t.pop; b.w += t.pop; if (nearestKm(t.lat, t.lon, cen.list) > MILE) b.far += t.pop; });
    const rows = D().csa.filter(r => by[r.name]?.w).map(r => { const b = by[r.name]; return { name: r.name, pop: r.pop2020 || b.w, prio: priority(r), km: nearestKm(b.y / b.w, b.x / b.w, cen.list), far: b.far }; })
      .filter(r => r.prio != null);
    const list = rows.filter(r => r.prio >= 55 && r.km > MILE * .75).sort((a, b) => b.prio * b.km - a.prio * a.km);
    el.innerHTML = (list.length ? `<div class="tablewrap"><table class="btable"><thead><tr><th>Neighborhood</th><th>Priority</th><th class="num">Nearest of the ${cen.list.length} ${cen.label}</th><th class="num">Residents over 1 mile away</th></tr></thead><tbody>` +
      list.map(r => `<tr><td><b>${U.esc(r.name)}</b> <a class="small" href="#nb/${encodeURIComponent(r.name)}">one-page brief</a></td><td>${bar(r.prio)}</td><td class="num">${U.dist(r.km)}</td><td class="num">${Math.round(r.far).toLocaleString()}</td></tr>`).join("") + `</tbody></table></div>`
      : `<p class="note">No neighborhood combines high priority with a long trip to the nearest center this season.</p>`) +
      `<div class="chartbox" style="height:300px;margin-top:12px"><canvas id="eqChart" aria-label="Chart of need against distance to the nearest center for each neighborhood" role="img"></canvas></div>
      <p class="note">Listed when the overall priority score is 55 or higher and the nearest center is more than about three-quarters of a mile from the neighborhood's population-weighted center. The chart shows every neighborhood: farther right is farther from help, higher is more need. The top-right corner is where a new or extended center would do the most good.</p>`;
    const c = getComputedStyle(document.documentElement), ink = c.getPropertyValue("--ink-2").trim() || "#aaa", line = c.getPropertyValue("--line").trim() || "#333";
    if (OFF.eq) OFF.eq.destroy();
    OFF.eq = new Chart(U.$("#eqChart"), { type: "scatter", data: { datasets: [{ data: rows.map(r => ({ x: +(U.unit() === "F" ? r.km / MILE : r.km).toFixed(2), y: +r.prio.toFixed(1), n: r.name })), pointRadius: 5, pointBackgroundColor: rows.map(r => r.prio >= 55 && r.km > MILE * .75 ? "#ec4a55" : "#6fb3ea") }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: k => `${k.raw.n}: priority ${k.raw.y}, ${k.raw.x} ${U.unit() === "F" ? "mi" : "km"}` } } },
        scales: { x: { title: { display: true, text: `Distance to nearest center (${U.unit() === "F" ? "miles" : "km"})`, color: ink }, ticks: { color: ink }, grid: { color: line } }, y: { min: 0, max: 100, title: { display: true, text: "Overall priority (higher = more need)", color: ink }, ticks: { color: ink }, grid: { color: line } } } } });
  }

  // ---------------- what-if: a new center ----------------
  let wMap, wMark, wLayer;
  function whatif(el) {
    if (!wMap) {
      el.innerHTML = `<div class="mapwrap" style="height:380px"><div id="wMap" style="height:100%" role="application" aria-label="Map: tap to place a test center"></div></div><div id="wOut" class="whatif-out"><p class="note">Tap anywhere in the city to test a new center. Blue dots are today's ${seasonCenters().label}.</p></div>`;
      wMap = APP.makeMap("wMap", { zoom: 11.5, scroll: false });
      wLayer = L.layerGroup(seasonCenters().list.map(x => L.circleMarker([x.lat, x.lon], { radius: 5, color: "#fff", weight: 1.5, fillColor: "#1d6fb8", fillOpacity: 1 }).bindTooltip(U.esc(x.name)))).addTo(wMap);
      wMap.on("click", e => test(e.latlng.lat, e.latlng.lng));
    }
    setTimeout(() => wMap.invalidateSize(), 120);
  }
  function test(lat, lon) {
    const cen = seasonCenters(), T = tracts();
    if (!APP.tractAt(lat, lon)) { U.$("#wOut").innerHTML = `<p class="note">That spot is outside Baltimore City. Tap inside the city line.</p>`; return; }
    if (wMark) { wMark.remove(); }
    wMark = L.layerGroup([L.circle([lat, lon], { radius: MILE * 1000, color: "#e8a800", weight: 2, fillOpacity: .08 }), L.marker([lat, lon], { title: "Test site", alt: "Test site" })]).addTo(wMap);
    const gain = T.filter(t => nearestKm(t.lat, t.lon, cen.list) > MILE && U.km([lon, lat], [t.lon, t.lat]) <= MILE);
    const pop = gain.reduce((a, t) => a + t.pop, 0), hot = gain.filter(t => (t.p.t_heat ?? 0) >= 80).reduce((a, t) => a + t.pop, 0);
    const vuln = gain.filter(t => (priority(t.p) ?? 0) >= 60).reduce((a, t) => a + t.pop, 0), hoods = [...new Set(gain.map(t => t.p.csa))];
    const nb = APP.tractAt(lat, lon) ? D().byId[APP.tractAt(lat, lon)].properties.csa : "";
    U.$("#wOut").innerHTML = `<div class="kpis small"><div class="kpi"><b>${Math.round(pop).toLocaleString()}</b><span>residents would newly live within a mile of a center</span></div>
      <div class="kpi"><b>${Math.round(vuln).toLocaleString()}</b><span>of them in high-priority tracts (score 60+)</span></div>
      <div class="kpi"><b>${Math.round(hot).toLocaleString()}</b><span>in the hottest fifth of the city</span></div>
      <div class="kpi"><b>${hoods.length}</b><span>neighborhoods reached${hoods.length ? ": " + hoods.slice(0, 4).map(U.esc).join(", ") + (hoods.length > 4 ? "…" : "") : ""}</span></div></div>
      <p class="note">Test site in ${U.esc(nb)}. Counts use each census tract's 2020 population, assigned by the tract's center point; a tract counts if its center is within a mile of the test site and more than a mile from all of today's ${cen.label}. Straight-line distance, so real walking trips are longer.</p>`;
  }

  // ---------------- change maps ----------------
  let cMap, cLayer;
  async function changeMap(el) {
    let T; try { T = await MORE.file("trends.json"); } catch { el.innerHTML = ""; return; }
    const keys = MORE.TREND_ORDER.filter(k => T.series[k]);
    if (!cMap) {
      el.innerHTML = `<div class="controls"><label for="chSel" class="muted" style="font-weight:600">Show change in</label><select id="chSel">${keys.map(k => `<option value="${k}">${U.esc(T.series[k].label)}</option>`).join("")}</select></div>
        <div class="mapwrap" style="height:380px"><div id="cMap" style="height:100%" role="img" aria-label="Map of change by neighborhood"></div></div><p class="note" id="chNote"></p>`;
      cMap = APP.makeMap("cMap", { zoom: 11.5, scroll: false });
      cLayer = L.geoJSON(D().tracts, { style: { weight: .4, color: "#fff", fillOpacity: .05 } }).addTo(cMap);
      U.$("#chSel").onchange = () => paint(T);
    }
    paint(T); setTimeout(() => cMap.invalidateSize(), 120);
  }
  function paint(T) {
    const k = U.$("#chSel").value, real = new Set(D().csa.map(r => r.name));
    const ch = {}; Object.entries(T.csa).filter(([n]) => real.has(n)).forEach(([n, c]) => { if (c[k]) { const x = MORE.change(k, k === "lead" ? MORE.nonzero(c[k]) : c[k], T.series[k]); if (x) ch[n] = x; } });
    const mags = Object.values(ch).map(x => Math.abs(x.raw || 0)).sort((a, b) => a - b), top = mags[Math.floor(mags.length * .9)] || 1;
    cLayer.setStyle(f => { const p = f.properties, x = ch[p.csa]; if (p.nonres || !x || x.worse == null) return { color: "#fff", weight: .3, fillColor: "#888", fillOpacity: .08 };
      const m = Math.min(1, Math.abs(x.raw || 0) / top);
      return { color: "#fff", weight: .3, fillColor: x.worse ? "#e04a4a" : "#2fa36b", fillOpacity: .15 + .6 * m }; });
    cLayer.eachLayer(l => { const x = ch[l.feature.properties.csa]; l.unbindTooltip(); if (x) l.bindTooltip(`${U.esc(l.feature.properties.csa)}: ${U.esc(String(x.d))} (${x.y0}–${x.y1})`, { sticky: true }); });
    const worse = Object.values(ch).filter(x => x.worse).length, n = Object.keys(ch).length;
    U.$("#chNote").textContent = `${T.series[k].label}: things got harder in ${worse} of ${n} neighborhoods. Red = harder, green = easier; stronger color = bigger change. Source: ${k === "heat" ? "Baltimore Heat Atlas (Landsat)" : "Baltimore Neighborhood Indicators Alliance, Vital Signs"}.`;
  }

  // ---------------- one-page neighborhood brief ----------------
  async function nbShow([name]) {
    name = name && decodeURIComponent(name);
    const r = D().csa.find(x => x.name === name), el = U.$("#nbBody");
    U.$("#nbPick").innerHTML = D().csa.map(x => `<option${x.name === name ? " selected" : ""}>${U.esc(x.name)}</option>`).join("");
    U.$("#nbPick").onchange = e => location.hash = "nb/" + encodeURIComponent(e.target.value);
    if (!r) { el.innerHTML = `<p class="note">Pick a neighborhood above.</p>`; return; }
    const ts = tracts().filter(t => t.p.csa === name), pop = ts.reduce((a, t) => a + t.pop, 0);
    const lat = ts.reduce((a, t) => a + t.lat * t.pop, 0) / (pop || 1), lon = ts.reduce((a, t) => a + t.lon * t.pop, 0) / (pop || 1);
    const ind = D().ind, cen = seasonCenters();
    const facts = ["lst_popw_c", "pct_tree", "pct_poverty", "pl_CASTHMA", "pl_COPD", "pct_65_alone", "pct_no_vehicle", "pct_rent_burden50", "pct_pre1940", "pl_FOODINSECU"].filter(k => r[k] != null && ind[k]);
    let A = null, T = null; try { [A, T] = await Promise.all([CITY.at(lat, lon), MORE.file("trends.json")]); } catch {}
    const tr = T?.csa?.[name] || {}, keys = T ? MORE.TREND_ORDER.filter(k => T.series[k] && tr[k]) : [];
    const S = A?.S || {}, inN = list => (list || []).filter(x => ts.some(t => U.km([t.lon, t.lat], [x.lon, x.lat]) < .8)).length;
    const far = ts.filter(t => nearestKm(t.lat, t.lon, cen.list) > MILE).reduce((a, t) => a + t.pop, 0);
    el.innerHTML = `<div class="nb-head"><div><span class="eyebrow">Neighborhood brief</span><h2>${U.esc(name)}</h2><p class="muted">${Math.round(r.pop2020 || pop).toLocaleString()} residents · ${ts.length} census tracts${A?.council ? ` · City Council District ${A.council.district} (${U.esc(A.council.member)})` : ""}</p></div>
        <div class="nb-prio">${bar(priority(r))}<small>Overall priority (0–100, higher = more need)</small></div></div>
      <div class="nb-grid"><div><h3>Scores compared with the rest of Baltimore</h3><table class="numbers"><tbody>${THEMES.map(k => `<tr><td>${TNAME[k]}</td><td>${bar(r["t_" + k])}</td></tr>`).join("")}</tbody></table>
        <h3>Key numbers</h3><table class="numbers"><tbody>${facts.map(k => `<tr><td>${U.esc(ind[k].label)}</td><td class="n">${U.fmt(r[k], ind[k].decimals, ind[k].unit)}</td><td class="n muted">city ${U.fmt(D().med[k], ind[k].decimals, ind[k].unit)}</td></tr>`).join("")}</tbody></table></div>
      <div><h3>How it's changing</h3>${keys.length ? `<table class="numbers"><tbody>${keys.map(k => { const x = MORE.change(k, k === "lead" ? MORE.nonzero(tr[k]) : tr[k], T.series[k]); return x ? `<tr><td>${U.esc(T.series[k].label)}</td><td class="n ${x.worse == null ? "" : x.worse ? "worse" : "better"}">${U.esc(String(x.d))}</td><td class="n muted">${x.y0}–${x.y1}</td></tr>` : ""; }).join("")}</tbody></table>` : `<p class="muted">No trend data.</p>`}
        <h3>Help and services</h3><ul class="nb-list"><li>${far ? `<b>${Math.round(far).toLocaleString()}</b> residents live more than a mile from the nearest of ${cen.list.length} ${cen.label}.` : `Every part is within about a mile of one of the ${cen.label}.`}</li>
          <li>Within about half a mile: ${inN(S.libraries)} libraries, ${inN(S.seniors)} senior centers, ${inN(S.gardens)} gardens or urban farms, ${inN(S.wifi)} free Wi-Fi sites.</li>
          ${A?.trash ? `<li>Trash pickup ${U.esc(A.trash.trash)}, recycling ${U.esc(A.trash.recycling)} (at the neighborhood's center).</li>` : ""}
          ${A?.council ? `<li>Council member: ${U.esc(A.council.member)}, ${U.esc(A.council.phone || "")}${A.council.email ? ", " + U.esc(A.council.email) : ""}.</li>` : ""}</ul></div></div>
      <p class="note">Scores are city ranks among residential census tracts, combined to the neighborhood (Community Statistical Area) from tract counts. The heat trend comes from satellite images of a few clear summer days each year, so treat it as a signal, not a precise warming rate. Data build ${new Date(D().meta.built).toLocaleDateString("en-US", { dateStyle: "long" })}. Sources: U.S. Census Bureau ACS 2020–2024, CDC PLACES, CDC/ATSDR SVI, Baltimore Heat Atlas, BNIA Vital Signs, Baltimore City. Live: ${location.origin}${location.pathname}#nb/${encodeURIComponent(name)}</p>`;
  }

  // ---------------- methods ----------------
  function methodsShow() {
    const ind = D().ind, cat = D().catalog;
    const WHY = { heat: "How hot the ground and air get where people live, by day (Landsat satellite, population-weighted) and night (MODIS satellite).", trees: "How much tree canopy and green cover there is. Shade cools blocks by several degrees on hot days.",
      health: "Adult rates of conditions that make heat, cold and bad air more dangerous: asthma, COPD, heart disease and diabetes (CDC PLACES model estimates).", social: "Social vulnerability (CDC/ATSDR SVI) and poverty: how hard it is for households to prepare for and recover from hazards.",
      energy: "Housing and energy strain: utility shut-off threats, housing insecurity, rent above half of income, and pre-1940 housing (drafty, lead-paint era).", mobility: "Getting around and food: households without a car, lack of reliable transportation, and food insecurity." };
    U.$("#methodsBody").innerHTML = `<div class="card"><h2>How each score works</h2><ol class="steps">
        <li><b>Rank every tract.</b> For each measure, every residential census tract is ranked against the others from 0 to 100 (its percentile). The direction is set so that 100 always means harder, for example hotter or less shade.</li>
        <li><b>Average into themes.</b> Each theme score is the plain average of the ranks of its measures, listed below.</li>
        <li><b>Combine to neighborhoods.</b> Neighborhood (Community Statistical Area) values are rebuilt from tract counts where possible, otherwise population-weighted averages, and then ranked the same way.</li>
        <li><b>Overall priority</b> on the City brief is the average of the heat, low-shade, health and social-vulnerability themes.</li>
        <li><b>Uncertainty.</b> Census survey numbers come with a 90% margin of error. A measure is flagged as a rough estimate when its margin is more than about half the value (coefficient of variation over 30%).</li></ol>
        <p class="note">Scores describe places, not individual people, and show where pressures overlap; they do not prove cause. Non-residential tracts (the port, the jail complex, parks) are excluded.</p></div>
      ${cat.themes.map(t => `<div class="card"><h3>${U.esc(t.label)}</h3><p>${WHY[t.key] || ""}</p><ul>${t.inputs.filter(k => ind[k]).map(k => `<li><b>${U.esc(ind[k].label)}</b>${ind[k].unit ? ` (${U.esc(U.unitLabel(ind[k].unit))})` : ""}. ${U.esc(D().meta.sources[ind[k].source]?.by || "")}${ind[k].vintage ? ", " + U.esc(ind[k].vintage) : ""}.</li>`).join("")}</ul></div>`).join("")}
      <div class="card"><h3>Distances and "near"</h3><p>Distances are straight lines from a point (your address, or a neighborhood's population-weighted center) to each place. "Within a mile" uses 1.609 km. Real walking routes are longer.</p></div>
      <div class="card"><h3>Citations</h3><ul class="small">${Object.values(D().meta.sources).map(s => `<li>${U.esc(s.by)}. <i>${U.esc(s.name)}</i>. ${U.esc(s.vintage || "")}. <a href="${U.esc(s.url)}" target="_blank" rel="noopener">${U.esc(s.url.replace(/^https?:\/\//, "").slice(0, 60))}</a></li>`).join("")}</ul></div>`;
  }

  function briefExtras() {
    const go = (id, fn) => { const el = U.$(id); if (el) try { fn(el); } catch (e) { console.warn(e); } };
    go("#bDistricts", districts); go("#bEquity", equity); go("#bWhatif", whatif); go("#bChange", changeMap);
  }
  return { briefExtras, eq: null, views: { nb: { show: nbShow }, methods: { show: methodsShow } } };
})();
