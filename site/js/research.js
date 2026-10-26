/* Data section: explorer, compare, correlate, live feeds, download */
const RSC = (() => {
  const D = () => APP.data;
  const charts = {};
  const cc = () => ({ ink: U.cssVar("--ink-2"), line: U.cssVar("--line") });
  const rampFor = (i, unitMode) => unitMode === "pc" || i.direction > 0 ? U.RAMP : i.direction < 0 ? U.RAMP_GREEN : U.RAMP_SEQ;
  function indicatorOptions(sel, selected, level) {
    const cats = {}; D().catalog.indicators.filter(i => !level || i.level === "tract" || level === "csa").forEach(i => (cats[i.category] = cats[i.category] || []).push(i));
    sel.innerHTML = Object.entries(cats).map(([c, xs]) => `<optgroup label="${U.esc(c)}">${xs.map(i => `<option value="${i.key}" ${i.key === selected ? "selected" : ""}>${U.esc(i.label)}</option>`).join("")}</optgroup>`).join("");
    if (!sel.value || ![...sel.options].some(o => o.value === selected)) sel.selectedIndex = 0;
  }
  function cv(p, i) {
    if (!i.uncertainty) return null; const u = p[i.key + (i.uncertainty === "moe90" ? "_moe" : "_se")], v = p[i.key];
    if (u == null || !v) return null; return (i.uncertainty === "moe90" ? u / 1.645 : u) / Math.abs(v);
  }
  const uLab = i => i.uncertainty === "se" ? "SE" : "MOE (90%)";
  const uKey = i => i.key + (i.uncertainty === "se" ? "_se" : "_moe");

  // ---------------- EXPLORER ----------------
  const S = { key: U.store.get("exKey", "hvi"), unit: "value", geo: "tract", sort: { col: "v", dir: -1 }, filter: "" };
  let exMap, exLayer;
  function rowsFor() {
    const i = D().ind[S.key];
    if (S.geo === "csa") return D().csa.map(c => ({ id: c.id, name: c.name, csa: c.name, v: c[S.key], pc: c["pc_" + S.key], moe: c[uKey(i)], cv: cv(c, i), pop: c.pop2020 }));
    return D().res.map(f => { const p = f.properties; return { id: p.id, name: p.name, csa: p.csa, v: p[S.key], pc: p["pc_" + S.key], moe: p[uKey(i)], cv: cv(p, i), pop: p.pop2020 }; });
  }
  function exInit() {
    indicatorOptions(U.$("#exInd"), S.key, S.geo);
    U.$("#exInd").onchange = e => { S.key = e.target.value; U.store.set("exKey", S.key); exRender(); };
    U.$$("[data-ex]").forEach(b => b.onclick = () => { S.unit = b.dataset.ex; U.$$("[data-ex]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); exRender(); });
    U.$$("[data-geo-level]").forEach(b => b.onclick = () => { S.geo = b.dataset.geoLevel; U.$$("[data-geo-level]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); indicatorOptions(U.$("#exInd"), S.key, S.geo); S.key = U.$("#exInd").value; exRender(); });
    U.$("#exFilter").oninput = e => { S.filter = e.target.value.toLowerCase(); exTable(); };
    exMap = APP.makeMap("exMap");
    exLayer = L.geoJSON(D().tracts, { onEachFeature: (f, l) => { l.on("mouseover", () => l.setStyle({ weight: 2.5, color: "#123247" })); l.on("mouseout", () => l.setStyle({ weight: .6, color: f.properties.nonres ? "#8a7f70" : "#fff" })); l.bindTooltip(() => tip(f.properties), { sticky: true }); } }).addTo(exMap);
    document.addEventListener("themechange", () => APP.view === "explore" && exRender());
  }
  function tip(p) {
    const i = D().ind[S.key];
    if (p.nonres) return `<b>${U.esc(p.name)}</b><br>${U.esc(p.nonres)}`;
    if (S.geo === "csa") { const c = D().csaByName[p.csa]; if (!c) return U.esc(p.csa || "—"); return `<b>${U.esc(c.name)}</b> (neighborhood)<br>${U.esc(i.label)}: <b>${U.fmt(c[S.key], i.decimals, i.unit)}</b><br>City percentile: ${U.fmt(c["pc_" + S.key], 0)}`; }
    const c = cv(p, i);
    return `<b>${U.esc(p.csa)}</b> · ${U.esc(p.name)}<br>${U.esc(i.label)}: <b>${U.fmt(p[S.key], i.decimals, i.unit)}</b>${p[uKey(i)] != null ? ` (${uLab(i)} ${U.fmt(p[uKey(i)], i.decimals)})` : ""}${c != null && c > .3 ? '<br><span class="flag">Low reliability (CV > 30%)</span>' : ""}<br>City percentile (burden): ${U.fmt(p["pc_" + S.key], 0)}`;
  }
  function exRender() {
    const i = D().ind[S.key], rows = rowsFor();
    const valOf = f => { const p = f.properties; if (p.nonres) return null; if (S.geo === "csa") { const c = D().csaByName[p.csa]; return c ? (S.unit === "pc" ? c["pc_" + S.key] : c[S.key]) : null; } return S.unit === "pc" ? p["pc_" + S.key] : p[S.key]; };
    const br = S.unit === "pc" ? [20, 40, 60, 80] : U.breaks(rows.map(r => r.v)); const R = rampFor(i, S.unit);
    exLayer.setStyle(f => { if (f.properties.nonres) return APP.NONRES_STYLE; const k = U.classify(valOf(f), br); return { color: "#fff", weight: .6, fillOpacity: k < 0 ? .08 : .78, fillColor: k < 0 ? "#bbb" : R[k] }; });
    const lab = v => S.unit === "pc" ? Math.round(v) : U.fmt(v, i.decimals, i.unit === "$" ? "$" : i.unit === "°C" || i.unit === "°Cd" ? i.unit : "");
    APP.legend(exMap, S.unit === "pc" ? "City percentile (100 = most burdened)" : `${i.label}${i.unit && !["$", "people", "°C", "°Cd"].includes(i.unit) ? " (" + i.unit + ")" : ""}`,
      R.map((c, k) => [c, k === 0 ? `≤ ${lab(br[0])}` : k === 4 ? `> ${lab(br[3])}` : `${lab(br[k - 1])} – ${lab(br[k])}`]).reverse().concat([["#cfc8bb", "Non-residential"]]));
    U.$("#exTitle").textContent = i.label;
    U.$("#exSrc").innerHTML = `${U.esc(i.category)} · ${U.esc(D().meta.sources[i.source]?.name || i.source)} <span class="chip">${U.esc(i.vintage || "")}</span>${i.level === "csa" ? ' <span class="chip">neighborhood-level</span>' : ""}`;
    const vals = rows.map(r => r.v).filter(v => v != null);
    const pw = U.wmean(rows.map(r => r.v), rows.map(r => r.pop || 0));
    const st = [["Median", U.quantile(vals, .5)], ["Mean", U.mean(vals)], ["Pop.-weighted", pw], ["Min", Math.min(...vals)], ["Max", Math.max(...vals)], ["Areas", vals.length]];
    U.$("#exStats").innerHTML = st.map(([k, v]) => `<div><div class="kicker" style="margin:0">${k}</div><b style="font-family:var(--display);font-size:1.25rem">${k === "Areas" ? v : U.fmt(v, i.decimals, i.unit)}</b></div>`).join("");
    const flagged = rows.filter(r => r.cv != null && r.cv > .3).length;
    U.$("#exMoe").innerHTML = (i.direction > 0 ? "Higher values mean more burden. " : i.direction < 0 ? "Higher values are better. " : "Context variable with no better or worse direction. ") +
      (i.uncertainty && rows.some(r => r.moe != null) ? `${flagged} of ${rows.length} areas have a coefficient of variation above 30% (marked in the table). ` : i.uncertainty ? "No margin of error is available at this geography. " : "") +
      (S.geo === "csa" && i.source === "acs" ? (i.key === "median_income" ? `Neighborhood median income: ${D().csa[0]?.median_income_method || "approximate"}. ` : D().csa[0]?.[i.key + "_moe"] != null ? "Neighborhood shares are recomputed from pooled tract counts. " : "Neighborhood values are population-weighted averages of tracts. ") : "") +
      (i.level === "csa" && S.geo === "tract" ? "This measure exists only at neighborhood level." : "") + ` ${D().meta.nonres ? Object.keys(D().meta.nonres).length + " non-residential tracts are excluded." : ""}`;
    const lo = Math.min(...vals), hi = Math.max(...vals), nb = 20, w = (hi - lo) / nb || 1;
    const counts = Array(nb).fill(0); vals.forEach(v => counts[Math.min(nb - 1, Math.floor((v - lo) / w))]++);
    const toU = x => (i.unit === "°C" && U.unit() === "F") ? U.cToF(x) : (i.unit === "°Cd" && U.unit() === "F") ? x * 9 / 5 : x;
    const labels = counts.map((_, k) => (+toU(lo + w * (k + .5))).toFixed(i.decimals));
    const col = counts.map((_, k) => R[U.classify(lo + w * (k + .5), br)] || R[2]);
    const c = cc(); if (charts.hist) charts.hist.destroy();
    charts.hist = new Chart(U.$("#exHist"), { type: "bar", data: { labels, datasets: [{ data: counts, backgroundColor: col, borderWidth: 0, barPercentage: 1, categoryPercentage: .95, borderRadius: 3 }] },
      options: { maintainAspectRatio: false, animation: { duration: FX.reduce ? 0 : 900, easing: "easeOutQuart" }, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: c.ink, maxTicksLimit: 8 }, grid: { display: false }, title: { display: true, text: U.unitLabel(i.unit), color: c.ink } }, y: { ticks: { color: c.ink }, grid: { color: c.line }, title: { display: true, text: S.geo === "csa" ? "Neighborhoods" : "Tracts", color: c.ink } } } } });
    exTable();
  }
  function exTable() {
    const i = D().ind[S.key]; let rows = rowsFor();
    if (S.filter) rows = rows.filter(r => (r.name + " " + r.csa).toLowerCase().includes(S.filter));
    const { col, dir } = S.sort; rows.sort((a, b) => { const x = a[col], y = b[col]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir; });
    const th = (c, t, num) => `<th data-col="${c}" class="${num ? "num" : ""}">${t}${S.sort.col === c ? (S.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`;
    const showU = !!i.uncertainty;
    U.$("#exTable").innerHTML = `<thead><tr>${th("name", S.geo === "csa" ? "Neighborhood" : "Tract")}${S.geo === "tract" ? th("csa", "Neighborhood") : ""}${th("v", U.esc(i.label), 1)}${showU ? th("moe", uLab(i), 1) : ""}${th("pc", "Percentile", 1)}${th("pop", "Population", 1)}</tr></thead><tbody>` +
      rows.map(r => `<tr data-id="${U.esc(r.id)}"><td>${U.esc(r.name)}</td>${S.geo === "tract" ? `<td>${U.esc(r.csa)}</td>` : ""}<td class="num">${U.fmt(r.v, i.decimals, i.unit)}${r.cv > .3 ? ' <span class="flag" title="Coefficient of variation above 30%">${I("info", 15)}</span>' : ""}</td>${showU ? `<td class="num">${U.fmt(r.moe, i.decimals)}</td>` : ""}<td class="num">${U.fmt(r.pc, 0)}</td><td class="num">${U.fmt(r.pop, 0)}</td></tr>`).join("") + "</tbody>";
    U.$$("#exTable th").forEach(h => h.onclick = () => { const c = h.dataset.col; S.sort = { col: c, dir: S.sort.col === c ? -S.sort.dir : (c === "name" || c === "csa" ? 1 : -1) }; exTable(); });
    U.$$("#exTable tbody tr").forEach(tr => tr.onclick = () => {
      const id = tr.dataset.id; const ids = id.startsWith("csa:") ? D().csaByName[id.slice(4)].tracts : [id];
      const b = L.latLngBounds([]); exLayer.eachLayer(l => { if (ids.includes(l.feature.properties.id)) b.extend(l.getBounds()); });
      if (b.isValid()) { try { exMap.flyToBounds(b, { maxZoom: 14, padding: [20, 20], duration: .8 }); } catch { exMap.fitBounds(b, { maxZoom: 14 }); } U.$("#exMap").scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }

  // ---------------- COMPARE ----------------
  function placeOptions(sel, val) {
    sel.innerHTML = `<optgroup label="Neighborhoods (CSA)">${D().csa.map(c => `<option value="${U.esc(c.id)}">${U.esc(c.name)}</option>`).join("")}</optgroup><optgroup label="Census tracts">${[...D().res].sort((a, b) => a.properties.csa.localeCompare(b.properties.csa)).map(f => `<option value="${f.properties.id}">${U.esc(f.properties.csa)} · ${U.esc(f.properties.name)}</option>`).join("")}</optgroup>`;
    sel.value = val; if (!sel.value) sel.selectedIndex = 0;
  }
  const getPlace = id => id.startsWith("csa:") ? D().csaByName[id.slice(4)] : D().byId[id].properties;
  function cmpInit() {
    placeOptions(U.$("#cmpA"), "csa:Greater Roland Park/Poplar Hill"); placeOptions(U.$("#cmpB"), "csa:Sandtown-Winchester/Harlem Park");
    U.$("#cmpA").onchange = U.$("#cmpB").onchange = cmpRender; cmpRender();
    document.addEventListener("themechange", () => APP.view === "compare" && cmpRender());
  }
  function cmpRender() {
    const a = getPlace(U.$("#cmpA").value), b = getPlace(U.$("#cmpB").value), nm = p => p.tracts ? p.name : p.csa + " · " + p.name;
    const th = D().catalog.themes, c = cc();
    if (charts.radar) charts.radar.destroy();
    charts.radar = new Chart(U.$("#cmpRadar"), { type: "radar", data: { labels: th.map(t => t.label), datasets: [
      { label: nm(a), data: th.map(t => a["t_" + t.key]), borderColor: "#b4472f", backgroundColor: "rgba(180,71,47,.18)", pointBackgroundColor: "#b4472f" },
      { label: nm(b), data: th.map(t => b["t_" + t.key]), borderColor: "#2f7fb5", backgroundColor: "rgba(47,127,181,.18)", pointBackgroundColor: "#2f7fb5" }] },
      options: { maintainAspectRatio: false, animation: { duration: FX.reduce ? 0 : 1000 }, plugins: { legend: { labels: { color: c.ink } } }, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: c.line }, angleLines: { color: c.line }, pointLabels: { color: c.ink, font: { size: 11 } } } } } });
    const diffs = D().catalog.indicators.filter(i => i.direction && a[i.key] != null && b[i.key] != null && a["pc_" + i.key] != null && b["pc_" + i.key] != null)
      .map(i => ({ i, d: a["pc_" + i.key] - b["pc_" + i.key] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 5);
    U.$("#cmpNotes").innerHTML = `<div class="kicker">Biggest gaps (city-percentile points)</div><ul class="list">${diffs.map(({ i, d }) => `<li><div>${U.esc(i.label)}<br><small class="muted">${U.fmt(a[i.key], i.decimals, i.unit)} vs ${U.fmt(b[i.key], i.decimals, i.unit)}</small></div><span class="meta"><b style="color:${d > 0 ? "#b4472f" : "#2f7fb5"}">${d > 0 ? "+" : ""}${Math.round(d)}</b></span></li>`).join("")}</ul><p class="note">Positive = the first place is more burdened.</p>`;
    let html = `<thead><tr><th>Indicator</th><th class="num">${U.esc(nm(a))}</th><th class="num">${U.esc(nm(b))}</th><th class="num">Difference</th><th class="num">City median (tracts)</th><th>Vintage</th></tr></thead><tbody>`;
    html += `<tr><td colspan="6" style="background:var(--surface-2);font-weight:600">Report-card scores (0–100, higher = more burdened)</td></tr>` + th.map(t => `<tr><td>${U.esc(t.label)}</td><td class="num">${U.fmt(a["t_" + t.key], 0)}</td><td class="num">${U.fmt(b["t_" + t.key], 0)}</td><td class="num">${a["t_" + t.key] != null && b["t_" + t.key] != null ? U.fmt(a["t_" + t.key] - b["t_" + t.key], 0) : "—"}</td><td class="num">50</td><td></td></tr>`).join("");
    let cat = "";
    D().catalog.indicators.forEach(i => {
      if (i.level === "csa" && !(a.tracts && b.tracts)) return;
      if (i.category !== cat) { cat = i.category; html += `<tr><td colspan="6" style="background:var(--surface-2);font-weight:600">${U.esc(cat)}</td></tr>`; }
      const va = a[i.key], vb = b[i.key], d = va != null && vb != null ? va - vb : null;
      const st = d == null || !i.direction ? "" : (d * i.direction > 0 ? "color:var(--bad)" : d * i.direction < 0 ? "color:var(--good)" : "");
      const dfmt = d == null ? "—" : (d > 0 ? "+" : "") + (i.unit === "°C" ? U.tC(d, i.decimals, true) : U.fmt(d, i.decimals, i.unit === "$" ? "$" : i.unit === "%" ? "" : ""));
      html += `<tr><td>${U.esc(i.label)}</td><td class="num">${U.fmt(va, i.decimals, i.unit)}</td><td class="num">${U.fmt(vb, i.decimals, i.unit)}</td><td class="num" style="${st}">${dfmt}${i.unit === "%" && d != null ? " pts" : ""}</td><td class="num">${U.fmt(D().med[i.key], i.decimals, i.unit)}</td><td><small class="muted">${U.esc(i.vintage || "")}</small></td></tr>`;
    });
    U.$("#cmpTable").innerHTML = html + "</tbody>";
  }

  // ---------------- CORRELATE ----------------
  const HOLC_C = { A: "#2e7a58", B: "#2f7fb5", C: "#d9a80f", D: "#b4472f" };
  function corInit() {
    indicatorOptions(U.$("#cx"), "pct_tree", "tract"); indicatorOptions(U.$("#cy"), "lst_popw_c", "tract");
    U.$("#cx").onchange = U.$("#cy").onchange = U.$("#cHolc").onchange = corRender;
    document.addEventListener("themechange", () => APP.view === "correlate" && corRender());
    corRender();
  }
  function corRender() {
    const kx = U.$("#cx").value, ky = U.$("#cy").value, ix = D().ind[kx], iy = D().ind[ky], holc = U.$("#cHolc").checked;
    const tx = v => ix.unit === "°C" && U.unit() === "F" ? U.cToF(v) : v, ty = v => iy.unit === "°C" && U.unit() === "F" ? U.cToF(v) : v;
    const pts = D().res.map(f => f.properties).filter(p => p[kx] != null && p[ky] != null);
    const x = pts.map(p => tx(p[kx])), y = pts.map(p => ty(p[ky])), n = pts.length;
    const r = U.pearson(x, y), rho = U.spearman(x, y);
    const mx = U.mean(x), my = U.mean(y); let sxy = 0, sxx = 0; x.forEach((v, k) => { sxy += (v - mx) * (y[k] - my); sxx += (v - mx) ** 2; }); const slope = sxy / sxx, icpt = my - slope * mx;
    const p = U.pval(rho, n);
    U.$("#cStats").innerHTML = `<div class="grid g2" style="gap:10px"><div><div class="kicker" style="margin:0">Spearman ρ</div><b class="big countup" style="font-size:1.9rem" id="rhoN">0</b></div><div><div class="kicker" style="margin:0">Pearson r</div><b class="big countup" style="font-size:1.9rem" id="rN">0</b></div></div>
      <p style="margin-top:10px">n = ${n} residential tracts · p ${p < .001 ? "< 0.001" : "= " + U.fmt(p, 3)}<br>OLS slope: ${U.fmt(slope, 3)} ${U.esc(U.unitLabel(iy.unit))} per ${U.esc(U.unitLabel(ix.unit))}</p>
      <p class="muted">${Math.abs(rho) >= .5 ? "Strong" : Math.abs(rho) >= .3 ? "Moderate" : Math.abs(rho) >= .1 ? "Weak" : "No meaningful"} ${rho >= 0 ? "positive" : "negative"} association.</p>`;
    FX.countUp(U.$("#rhoN"), rho, { dec: 2 }); FX.countUp(U.$("#rN"), r, { dec: 2 });
    const c = cc();
    const mk = (ps, color, label) => ({ label, data: ps.map(p => ({ x: tx(p[kx]), y: ty(p[ky]), n: p.csa + " · " + p.name })), backgroundColor: color + "cc", borderColor: color, pointRadius: 4, pointHoverRadius: 7 });
    const ds = holc ? [...Object.entries(HOLC_C).map(([g, col]) => mk(pts.filter(p => p.holc_grade === g), col, "HOLC grade " + g)), mk(pts.filter(p => !p.holc_grade), "#9a9a9a", "Not graded")] : [mk(pts, "#2f7fb5", "Tracts")];
    const xs = [Math.min(...x), Math.max(...x)];
    ds.push({ type: "line", label: "OLS fit", data: xs.map(v => ({ x: v, y: icpt + slope * v })), borderColor: "#b4472f", borderWidth: 2, pointRadius: 0, borderDash: [6, 4] });
    if (charts.cor) charts.cor.destroy();
    charts.cor = new Chart(U.$("#cChart"), { type: "scatter", data: { datasets: ds }, options: { maintainAspectRatio: false, animation: { duration: FX.reduce ? 0 : 900 },
      plugins: { legend: { display: holc, labels: { color: c.ink } }, tooltip: { callbacks: { label: k => k.raw.n ? `${k.raw.n}: (${k.raw.x.toFixed(ix.decimals)}, ${k.raw.y.toFixed(iy.decimals)})` : "fit" } } },
      scales: { x: { title: { display: true, text: `${ix.label} (${U.unitLabel(ix.unit)})`, color: c.ink }, ticks: { color: c.ink }, grid: { color: c.line } }, y: { title: { display: true, text: `${iy.label} (${U.unitLabel(iy.unit)})`, color: c.ink }, ticks: { color: c.ink }, grid: { color: c.line } } } } });
  }

  // ---------------- LIVE ----------------
  let liveWired = false;
  function liveShow() {
    const stat = s => { const st = LIVE.status[s.id], f = LIVE.feeds[s.id];
      if (!st) return '<span class="muted">Not requested yet</span>'; return st.ok ? `<span class="status live">● Live</span>` : `<span class="status err" title="${U.esc(st.err)}">Error, retrying</span>`; };
    const draw = () => {
      U.$("#liveTable").innerHTML = `<thead><tr><th>Feed</th><th>Provider</th><th>Status</th><th>Last update</th><th>Refresh</th></tr></thead><tbody>` + LIVE.SOURCES.map(s => {
        const st = LIVE.status[s.id]; return `<tr><td>${U.esc(s.name)}</td><td><a href="${s.url}" target="_blank" rel="noopener">${U.esc(s.by)}</a></td><td>${stat(s)}</td><td>${st ? U.timeAgo(st.at) : "—"}</td><td>${s.every ? "every " + s.every + " min" : "on request"}</td></tr>`; }).join("") + "</tbody>";
      const src = D().meta.sources;
      U.$("#releaseTable").innerHTML = `<thead><tr><th>Dataset</th><th>Publisher</th><th>Vintage</th><th>Status</th><th>Pulled</th></tr></thead><tbody>` + Object.values(src).map(s => {
        const cls = /live/.test(s.status) ? "live" : /cached|frozen/.test(s.status) ? "cached" : "";
        return `<tr><td><a href="${s.url}" target="_blank" rel="noopener">${U.esc(s.name)}</a></td><td>${U.esc(s.by)}</td><td>${U.esc(s.vintage)}</td><td><span class="status ${cls}">${U.esc(s.status)}</span></td><td>${new Date(s.retrieved).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>`; }).join("") + "</tbody>";
    };
    draw();
    if (liveWired) return; liveWired = true;
    document.addEventListener("live-status", () => APP.view === "live" && draw());
    ["weather", "air", "alerts", "meta"].forEach(k => LIVE.feeds[k].on(() => {}));
    U.$("#gaugeTable").innerHTML = `<tbody><tr><td><div class="skeleton" style="height:60px"></div></td></tr></tbody>`;
    LIVE.feeds.water.on(s => {
      if (!s) { U.$("#gaugeTable").innerHTML = `<tbody><tr><td>USGS Water Data API unavailable; retrying.</td></tr></tbody>`; return; }
      U.$("#gaugeTable").innerHTML = `<thead><tr><th>Site</th><th>USGS ID</th><th class="num">Flow (ft³/s)</th><th class="num">Water level (ft)</th><th class="num">Water temp</th><th>Updated</th></tr></thead><tbody>` +
        s.map(g => { const r = g.readings, t = Object.values(r).map(x => x.time).sort().pop(); return `<tr><td>${U.esc(RES.short(g.name))}</td><td><a href="https://waterdata.usgs.gov/monitoring-location/${U.esc(g.id)}/" target="_blank" rel="noopener">${U.esc(g.id.replace("USGS-", ""))}</a></td><td class="num">${U.fmt(r["00060"]?.value, 0)}</td><td class="num">${U.fmt(r["00065"]?.value, 2)}</td><td class="num">${r["00010"] ? U.tC(r["00010"].value) : "—"}</td><td>${U.timeAgo(t)}</td></tr>`; }).join("") + "</tbody>";
    });
    LIVE.feeds.airnow.on(s => {
      if (!s) { U.$("#monitorTable").innerHTML = `<tbody><tr><td>EPA AirNow feed unavailable; retrying.</td></tr></tbody>`; return; }
      U.$("#monitorTable").innerHTML = `<thead><tr><th>Monitor</th><th class="num">AQI</th><th>Pollutants (AQI)</th><th class="num">Distance</th><th>Updated</th></tr></thead><tbody>` +
        s.map(m => `<tr><td>${U.esc(m.name)}</td><td class="num"><span class="dot" style="background:${LIVE.aqiCat(m.aqi).c}"></span> ${Math.round(m.aqi)}</td><td>${Object.entries(m.readings).map(([p, r]) => `${U.esc(p)} ${Math.round(r.aqi)}`).join(" · ")}</td><td class="num">${U.dist(m.km)}</td><td>${m.time ? U.timeAgo(m.time) : "—"}</td></tr>`).join("") + "</tbody>";
    });
  }

  // ---------------- DOWNLOAD ----------------
  function dlInit() {
    U.$("#cite").textContent = `Sahil (${new Date().getFullYear()}). Charm City Pulse: live Baltimore environment and sustainability data [web application and dataset], data build ${D().meta.built.slice(0, 10)}. Johns Hopkins University. ${location.origin}${location.pathname}`;
    const I = () => D().catalog.indicators;
    const cols = (recs, base) => { const c = [...base]; I().forEach(i => { if (recs.some(r => r[i.key] !== undefined)) { c.push(i.key); if (i.uncertainty) c.push(uKey(i)); c.push("pc_" + i.key); } }); D().catalog.themes.forEach(t => c.push("t_" + t.key)); return c; };
    U.$("[data-dl=tracts]").onclick = () => { const recs = D().feats.map(f => f.properties); const c = cols(recs, ["id", "name", "csa", "nonres", "hvi_class", "holc_grade"]);
      U.download(`baltimore_tracts_${D().meta.built.slice(0, 10)}.csv`, [c.join(",")].concat(recs.map(r => c.map(k => U.csvCell(r[k])).join(","))).join("\n")); };
    U.$("[data-dl=csa]").onclick = () => { const recs = D().csa; const c = cols(recs, ["name", "median_income_method"]);
      U.download(`baltimore_neighborhoods_${D().meta.built.slice(0, 10)}.csv`, [c.join(",")].concat(recs.map(r => c.map(k => U.csvCell(r[k])).join(","))).join("\n")); };
  }

  return { views: {
    explore: { init: exInit, show: exRender, reload: exRender },
    compare: { init: cmpInit, show: cmpRender, reload() { cmpInit(); } },
    correlate: { init: corInit, show: corRender },
    live: { show: liveShow },
    download: { init: dlInit, show: dlInit },
  } };
})();
