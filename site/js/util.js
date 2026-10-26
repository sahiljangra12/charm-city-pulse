/* Shared helpers: DOM, storage, fetch, formatting, units, stats, geometry, colour */
const U = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ccp." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("ccp." + k, JSON.stringify(v)); } catch {} },
  };
  async function getJSON(url, opts = {}, ms = 15000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { ...opts, signal: ctl.signal });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  // ---------- units ----------
  const unit = () => store.get("unit", "F");
  const cToF = c => c * 9 / 5 + 32, fToC = f => (f - 32) * 5 / 9;
  /** format a temperature given in °F (live weather) */
  const tF = (f, d = 0) => f == null ? "—" : (unit() === "F" ? Math.round(f * 10 ** d) / 10 ** d : (Math.round(fToC(f) * 10 ** d) / 10 ** d)) + "°";
  /** format a temperature given in °C (research data); delta=true for differences */
  function tC(c, d = 1, delta = false) {
    if (c == null || Number.isNaN(c)) return "—";
    const v = unit() === "F" ? (delta ? c * 9 / 5 : cToF(c)) : c;
    return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + (unit() === "F" ? " °F" : " °C");
  }
  function fmt(v, dec = 1, u = "") {
    if (v == null || Number.isNaN(v)) return "—";
    if (u === "°C") return tC(v, dec);
    if (u === "°Cd") return (v > 0 ? "+" : "") + tC(v, dec, true);
    if (u === "$") return "$" + Math.round(v).toLocaleString();
    const s = Number(v).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (u === "%") return s + "%";
    if (u === "km") return s + " km";
    return s;
  }
  const unitLabel = u => u === "°C" || u === "°Cd" ? (unit() === "F" ? "°F" : "°C") : u;
  // NWS heat index (Rothfusz regression with adjustments), T in °F, RH in %
  function heatIndex(T, RH) {
    if (T == null || RH == null) return null;
    let HI = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
    if ((HI + T) / 2 < 80) return HI;
    HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - .22475541 * T * RH - .00683783 * T * T - .05481717 * RH * RH + .00122874 * T * T * RH + .00085282 * T * RH * RH - .00000199 * T * T * RH * RH;
    if (RH < 13 && T >= 80 && T <= 112) HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (RH > 85 && T >= 80 && T <= 87) HI += ((RH - 85) / 10) * ((87 - T) / 5);
    return HI;
  }
  // NWS wind chill (2001), T °F, V mph; defined for T <= 50 and V >= 3
  const windChill = (T, V) => (T == null || V == null || T > 50 || V < 3) ? T : 35.74 + .6215 * T - 35.75 * V ** .16 + .4275 * T * V ** .16;
  // ---------- stats ----------
  const clean = a => a.filter(v => v != null && !Number.isNaN(v));
  const mean = a => { a = clean(a); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; };
  function quantile(a, q) { a = clean(a).sort((x, y) => x - y); if (!a.length) return null; const p = (a.length - 1) * q, b = Math.floor(p); return a[b + 1] !== undefined ? a[b] + (p - b) * (a[b + 1] - a[b]) : a[b]; }
  function wmean(v, w) { let s = 0, ws = 0; v.forEach((x, i) => { if (x != null && w[i]) { s += x * w[i]; ws += w[i]; } }); return ws ? s / ws : null; }
  function pearson(x, y) {
    const n = x.length; if (n < 3) return null;
    const mx = mean(x), my = mean(y); let sxy = 0, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sx += a * a; sy += b * b; }
    return sxy / Math.sqrt(sx * sy);
  }
  function ranks(a) {
    const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]); const r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2; i = j + 1; }
    return r;
  }
  const spearman = (x, y) => pearson(ranks(x), ranks(y));
  function normCdf(z) { const t = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); }
  function pval(r, n) { if (r == null || n < 4) return null; const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r)); return 2 * (1 - normCdf(t)); }
  // ---------- geo ----------
  function inRing(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; }
  function inPoly(pt, coords) { if (!inRing(pt, coords[0])) return false; for (let h = 1; h < coords.length; h++) if (inRing(pt, coords[h])) return false; return true; }
  function inGeom(pt, g) { if (g.type === "Polygon") return inPoly(pt, g.coordinates); if (g.type === "MultiPolygon") return g.coordinates.some(c => inPoly(pt, c)); return false; }
  function km(a, b) { const R = 6371, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  const dist = k => unit() === "F" ? (k * 0.621371).toFixed(1) + " mi" : k.toFixed(1) + " km";
  // ---------- colour ----------
  const RAMP = ["#fbf3d5", "#f6d58a", "#eea052", "#d0672b", "#9e2f3c"];
  const RAMP_SEQ = ["#e9f2f7", "#b6d4e6", "#79aed1", "#3d7fb2", "#1d4f7c"];
  const RAMP_GREEN = ["#eef6ea", "#c4e1b5", "#8cc47e", "#4e9a57", "#1f6b3f"];
  function band(pc) {
    if (pc == null) return { label: "No data", color: "#999", word: "no data" };
    if (pc >= 80) return { label: "Among the most burdened 20%", color: "var(--bad)", word: "very high" };
    if (pc >= 60) return { label: "Above the city middle", color: "var(--poor)", word: "high" };
    if (pc >= 40) return { label: "Around the city middle", color: "var(--fair)", word: "moderate" };
    if (pc >= 20) return { label: "Below the city middle", color: "var(--marsh)", word: "low" };
    return { label: "Among the least burdened 20%", color: "var(--good)", word: "very low" };
  }
  function breaks(vals, k = 5) { const a = clean(vals); return Array.from({ length: k - 1 }, (_, i) => quantile(a, (i + 1) / k)); }
  function classify(v, br) { if (v == null) return -1; let i = 0; while (i < br.length && v > br[i]) i++; return i; }
  function download(name, text, type = "text/csv") {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  const csvCell = v => v == null ? "" : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function timeAgo(d) { const s = Math.round((Date.now() - new Date(d)) / 1000); if (s < 45) return "just now"; const m = Math.round(s / 60); return m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; }
  function toast(msg, ms = 3800) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; requestAnimationFrame(() => t.classList.add("on")); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), ms); }
  const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
  return { $, $$, esc, store, getJSON, unit, cToF, fToC, tF, tC, fmt, unitLabel, heatIndex, windChill, mean, quantile, wmean, pearson, spearman, pval, inGeom, km, dist, RAMP, RAMP_SEQ, RAMP_GREEN, band, breaks, classify, download, csvCell, cssVar, timeAgo, toast, debounce };
})();
