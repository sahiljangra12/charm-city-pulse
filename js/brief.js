/* City brief: a one-page, printable summary for city and state officials.
   Ranks Baltimore's 55 neighborhoods (CSAs) on heat, shade, health and social vulnerability,
   and shows how far each is from the nearest warming or cooling center this season. */
const BRIEF = (() => {
  const D = () => APP.data;
  const C = ["var(--s0)", "var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
  const lvl = v => v == null ? -1 : v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0;
  const RANKS = {
    priority: { label: "Overall heat and health priority", short: "Priority", keys: ["heat", "trees", "health", "social"] },
    heat: { label: "Summer heat", keys: ["heat"] },
    trees: { label: "Lack of tree shade", keys: ["trees"] },
    health: { label: "Health sensitivity", keys: ["health"] },
    social: { label: "Social vulnerability", keys: ["social"] },
    energy: { label: "Housing and energy strain", keys: ["energy"] },
    mobility: { label: "Getting around and food", keys: ["mobility"] },
  };
  const COLS = [["heat", "Heat"], ["trees", "Low shade"], ["health", "Health"], ["social", "Social vuln."], ["energy", "Energy strain"]];
  const S = { rank: "priority", n: 15 };
  const FAR_KM = 1.6;   // about one mile

  // ----- which centers matter this season -----
  function seasonCenters() {
    const s = LIVE.season(), m = new Date().getMonth() + 1;
    const winter = s === "winter" || (s === "shoulder" && m >= 9);
    const c = D().centers;
    return winter
      ? { kind: "warming", label: "warming centers and shelters", when: c.winter?.sites?.length ? "open Nov 15 to Mar 15 when the wind chill reaches 32°F or below" : "", list: (c.winter?.sites || []).filter(x => x.lat != null) }
      : { kind: "cooling", label: "cooling centers", when: "open on Code Red heat days", list: c.cooling || [] };
  }
  const nearestKm = (lat, lon, list) => list.length ? Math.min(...list.map(x => U.km([lon, lat], [x.lon, x.lat]))) : null;

  // ----- neighborhood records with a population-weighted centre and nearest-centre distance -----
  function neighborhoods(centers) {
    const byCsa = {};
    D().feats.forEach(f => { const p = f.properties; if (p.nonres) return;
      const c = APP.centroid(f), w = p.pop2020 || 1, b = byCsa[p.csa] || (byCsa[p.csa] = { x: 0, y: 0, w: 0, tracts: [] });
      b.x += c[0] * w; b.y += c[1] * w; b.w += w; b.tracts.push({ p, c }); });
    return D().csa.filter(r => byCsa[r.name]).map(r => {
      const b = byCsa[r.name], lat = b.y / b.w, lon = b.x / b.w;
      const score = k => { const v = RANKS[k].keys.map(t => r["t_" + t]).filter(v => v != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const far = b.tracts.filter(t => (nearestKm(t.c[1], t.c[0], centers.list) ?? 0) > FAR_KM).reduce((a, t) => a + (t.p.pop2020 || 0), 0);
      return { r, lat, lon, score, km: nearestKm(lat, lon, centers.list), farPop: far };
    });
  }

  const bar = v => { const l = lvl(v); return l < 0 ? '<span class="muted">—</span>' : `<span class="bscore"><i style="background:${C[l]};--w:${Math.max(4, v) * .44}"></i><b>${Math.round(v)}</b></span>`; };
  const people = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n));

  function figures(rows, centers) {
    const h = D().research.heat, t = D().research.trees;
    const tracts = D().feats.map(f => f.properties).filter(p => !p.nonres);
    const hot = tracts.filter(p => (p.t_heat ?? 0) >= 80).reduce((a, p) => a + (p.pop2020 || 0), 0);
    const far = rows.reduce((a, x) => a + x.farPop, 0);
    const tile = (num, lab, note) => `<div class="kpi"><b>${num}</b><span>${lab}</span>${note ? `<small>${note}</small>` : ""}</div>`;
    return [
      tile(people(h.veryhigh_pop), "residents in very-high heat-vulnerability tracts", `${h.veryhigh_n} census tracts`),
      tile(people(hot), "residents in the hottest fifth of the city", "summer surface temperature"),
      tile(`+${U.tC(h.holc_lst_by_grade.D - h.holc_lst_by_grade.A, 1, true)}`, "hotter in 1937 redlined (D) areas than A areas", `tree cover ${h.holc_tree_by_grade.D}% vs ${h.holc_tree_by_grade.A}%`),
      tile(people(far), `residents more than a mile from the nearest of ${centers.list.length} ${centers.label}`, centers.when),
      tile(t.vacant_sites.toLocaleString(), "empty street-tree sites", `each young tree cools its block by about ${U.tC(Math.abs(t.per_tree_c), 2, true)}`),
    ].join("");
  }

  function table(rows) {
    const key = S.rank; const sorted = rows.filter(x => x.score(key) != null).sort((a, b) => b.score(key) - a.score(key));
    const list = S.n ? sorted.slice(0, S.n) : sorted;
    // a single-theme ranking is already one of the columns, so only the combined score gets its own column
    const lead = RANKS[key].keys.length > 1, cols = [...COLS, ...(COLS.some(c => c[0] === key) || lead ? [] : [[key, RANKS[key].label.replace("Getting around and food", "Getting around")]])];
    const th = (k, l) => `<th${k === key ? ' class="sorted"' : ""}>${l}</th>`;
    return `<thead><tr><th class="num">#</th><th>Neighborhood</th><th class="num">Residents</th>${lead ? th(key, RANKS[key].short) : ""}${cols.map(([k, l]) => th(k, l)).join("")}<th class="num">Nearest center</th></tr></thead><tbody>` +
      list.map((x, i) => { const r = x.r; return `<tr data-csa="${U.esc(r.name)}" tabindex="0"><td class="num">${i + 1}</td><td><b>${U.esc(r.name)}</b></td><td class="num">${Math.round(r.pop2020 || 0).toLocaleString()}</td>${lead ? `<td>${bar(x.score(key))}</td>` : ""}${cols.map(([k]) => `<td>${bar(r["t_" + k])}</td>`).join("")}<td class="num">${x.km == null ? "—" : U.dist(x.km)}</td></tr>`; }).join("") + "</tbody>";
  }

  function detail(name, rows) {
    const x = rows.find(y => y.r.name === name); if (!x) return "";
    const r = x.r, ind = D().ind;
    const facts = ["pct_poverty", "pct_tree", "pl_CASTHMA", "pct_65_alone", "pct_no_vehicle", "pct_rent_burden50", "lst_popw_c"].filter(k => r[k] != null && ind[k])
      .map(k => `<li><span>${U.esc(ind[k].label)}</span><b>${U.fmt(r[k], ind[k].decimals, ind[k].unit)}</b></li>`).join("");
    return `<tr class="bdetail"><td colspan="99"><div class="bdetail-in"><ul class="bfacts">${facts}</ul>
      <p class="note">Scores are city ranks from 0 to 100 among residential census tracts, where higher means harder. ${x.farPop ? `About ${Math.round(x.farPop).toLocaleString()} residents here live more than a mile from the nearest center open this season.` : "Every part of this neighborhood is within about a mile of a center open this season."}</p>
      <a class="btn small" href="#nb/${encodeURIComponent(name)}">One-page brief</a> <a class="btn small alt" href="#compare">Compare with another neighborhood</a></div></td></tr>`;
  }

  let rowsCache = null;
  function render() {
    const centers = seasonCenters(); const rows = rowsCache = neighborhoods(centers); const m = D().meta;
    U.$("#bDate").textContent = `Data build ${new Date(m.built).toLocaleDateString("en-US", { dateStyle: "long" })} · ${m.residential_tracts} residential census tracts · ${m.csas} neighborhoods`;
    U.$("#bFigures").innerHTML = figures(rows, centers);
    U.$("#bTable").innerHTML = table(rows);
    U.$("#bSeason").textContent = `Nearest center is the straight-line distance from the neighborhood's population-weighted center to the closest of ${centers.list.length} ${centers.label} (${centers.when}).`;
    trendsTable(rows); OFF.briefExtras();
    const src = m.sources;
    U.$("#bSources").innerHTML = ["acs", "places", "heat", "svi", "trees", centers.kind === "warming" ? "winter" : "cooling"].filter(k => src[k])
      .map(k => `<li>${U.esc(src[k].by)}. <i>${U.esc(src[k].name)}</i>, ${U.esc(src[k].vintage || "")}.</li>`).join("");
  }

  async function trendsTable(rows) {
    let T; try { T = await MORE.file("trends.json"); } catch { U.$("#bTrends").innerHTML = ""; return; }
    const keys = MORE.TREND_ORDER.filter(k => T.series[k]);
    const key = S.rank, list = rows.filter(x => x.score(key) != null).sort((a, b) => b.score(key) - a.score(key)).slice(0, S.n || 99);
    let up = 0, n = 0;
    const real = new Set(D().csa.map(r => r.name));
    Object.entries(T.csa).filter(([n]) => real.has(n)).map(([, c]) => c).forEach(c => { if (c.heat) { const ch = MORE.change("heat", c.heat, T.series.heat); if (ch) { n++; if (ch.worse) up++; } } });
    U.$("#bTrendNote").textContent = n ? `Summer surface heat rose in ${up} of ${n} neighborhoods between ${Object.keys(Object.values(T.csa).find(c => c.heat).heat).sort()[0]} and the latest summer. Listed in the same order as the table above.` : "";
    U.$("#bTrends").innerHTML = `<thead><tr><th>Neighborhood</th>${keys.map(k => `<th>${U.esc(T.series[k].label)}</th>`).join("")}</tr></thead><tbody>` +
      list.map(x => { const c = T.csa[x.r.name] || {};
        return `<tr><td><b>${U.esc(x.r.name)}</b></td>${keys.map(k => { const ch = c[k] && MORE.change(k, k === "lead" ? MORE.nonzero(c[k]) : c[k], T.series[k]);
          return ch ? `<td class="tcell ${ch.worse == null ? "" : ch.worse ? "worse" : "better"}"><span class="chg">${ch.d}</span><small>${ch.y0}–${ch.y1}</small></td>` : `<td class="muted">—</td>`; }).join("")}</tr>`; }).join("") + "</tbody>";
  }

  function init() {
    U.$("#bRank").innerHTML = Object.entries(RANKS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");
    U.$("#bRank").onchange = e => { S.rank = e.target.value; U.$("#bTable").innerHTML = table(rowsCache); trendsTable(rowsCache); };
    U.$("#bAll").onclick = e => { S.n = S.n ? 0 : 15; e.currentTarget.textContent = S.n ? "Show all 55" : "Show top 15"; U.$("#bTable").innerHTML = table(rowsCache); trendsTable(rowsCache); };
    U.$("#bTable").addEventListener("click", e => { const tr = e.target.closest("tr[data-csa]"); if (!tr) return;
      const open = tr.nextElementSibling?.classList.contains("bdetail"); U.$$("#bTable .bdetail").forEach(d => d.remove()); U.$$("#bTable tr.on").forEach(t => t.classList.remove("on"));
      if (!open) { tr.classList.add("on"); tr.insertAdjacentHTML("afterend", detail(tr.dataset.csa, rowsCache)); } });
    U.$("#bTable").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("tr[data-csa]")) e.target.click(); });
    U.$("#bPrint").onclick = () => window.print();
    U.$("#bShare").onclick = () => SHARE.link(location.origin + location.pathname + "#brief", "Baltimore heat and health brief");
    U.$("#bCsv").onclick = () => { const key = S.rank, rows = rowsCache.filter(x => x.score(key) != null).sort((a, b) => b.score(key) - a.score(key));
      const head = ["rank", "neighborhood", "residents_2020", key + "_score", ...COLS.map(c => c[0] + "_score"), "nearest_center_km", "residents_over_1mi_from_center"];
      U.download(`baltimore_brief_${key}_${D().meta.built.slice(0, 10)}.csv`, [head.join(",")].concat(rows.map((x, i) => [i + 1, x.r.name, Math.round(x.r.pop2020 || 0), x.score(key)?.toFixed(1), ...COLS.map(([k]) => x.r["t_" + k]), x.km?.toFixed(2), Math.round(x.farPop)].map(U.csvCell).join(","))).join("\n")); };
  }

  return { views: { brief: { init, show: render, reload: render } } };
})();

/* Share a link: the phone's share sheet when there is one, otherwise copy to the clipboard. */
const SHARE = {
  async link(url, title) {
    try { if (navigator.share && matchMedia("(pointer:coarse)").matches) { await navigator.share({ title, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); U.toast("Link copied. Paste it into an email or message."); }
    catch { prompt("Copy this link:", url); }
  },
};
