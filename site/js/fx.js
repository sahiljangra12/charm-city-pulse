/* Motion & visual components: reveal-on-scroll, count-up, sky scene, gauges, rings, sun path, refresh rings */
const FX = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- reveal on scroll ----------
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); e.target.dispatchEvent(new Event("reveal")); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: "0px 0px -30px 0px" }) : null;
  function reveal(root = document) {
    U.$$(".rv:not(.in)", root).forEach((el, i) => { el.style.transitionDelay = Math.min(i, 8) * 60 + "ms"; io ? io.observe(el) : el.classList.add("in"); });
  }
  function onReveal(el, fn) { if (!io || el.classList.contains("in")) return fn(); el.addEventListener("reveal", fn, { once: true }); if (!el.classList.contains("rv")) { el.classList.add("rv"); io.observe(el); } }

  // ---------- count-up numbers ----------
  function countUp(el, to, { dec = 0, dur = 1100, prefix = "", suffix = "" } = {}) {
    if (to == null || Number.isNaN(to)) { el.textContent = "—"; return; }
    const from = parseFloat(el.dataset.v ?? to * .6) || 0; el.dataset.v = to;
    if (reduce) { el.textContent = prefix + to.toFixed(dec) + suffix; return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = prefix + (from + (to - from) * e).toFixed(dec) + suffix; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---------- sky scene ----------
  function scene(kind, isDay, hot) {
    const W = 600, H = 320, r = (a, b) => a + Math.random() * (b - a);
    let s = `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
    if (isDay && (kind === "clear" || kind === "cloudy")) {
      s += `<g transform="translate(548 52) scale(.8)"><g class="sun-rays">${Array.from({ length: 12 }, (_, i) => `<rect x="-3" y="-86" width="6" height="26" rx="3" fill="rgba(255,236,170,.55)" transform="rotate(${i * 30})"/>`).join("")}</g>
        <circle r="46" fill="#ffd66b"/><circle r="62" fill="rgba(255,214,107,.18)"/></g>`;
    }
    if (!isDay) {
      s += Array.from({ length: 40 }, () => `<circle class="twinkle" cx="${r(0, W)}" cy="${r(0, H * .6)}" r="${r(.6, 1.8)}" fill="#fff" style="animation-delay:${r(0, 3)}s"/>`).join("");
      if (kind === "clear" || kind === "cloudy") s += `<g transform="translate(560 46) scale(.75)"><circle r="34" fill="#f4f1de"/><circle cx="14" cy="-8" r="30" fill="currentColor" style="color:#0f1f3a"/></g>`;
    }
    const nC = kind === "clear" ? 2 : kind === "cloudy" || kind === "fog" ? 6 : 7;
    for (let i = 0; i < nC; i++) {
      const y = r(-10, kind === "fog" ? 240 : 70), sc = r(.5, 1.1), op = (kind === "clear" ? .35 : kind === "storm" ? .45 : .5) * (isDay ? 1 : .7), dur = r(50, 110);
      s += `<g class="cloud" style="animation-duration:${dur}s;animation-delay:-${r(0, dur)}s"><g transform="translate(0 ${y}) scale(${sc})" fill="${kind === "storm" ? "#4b5266" : "#fff"}" opacity="${op}">
        <ellipse cx="60" cy="30" rx="60" ry="22"/><ellipse cx="100" cy="20" rx="44" ry="26"/><ellipse cx="34" cy="22" rx="30" ry="18"/></g></g>`;
    }
    if (kind === "rain" || kind === "storm") s += Array.from({ length: 70 }, () => { const x = r(0, W), d = r(.6, 1.1); return `<line class="drop" x1="${x}" y1="0" x2="${x - 4}" y2="16" stroke="rgba(200,225,255,.6)" stroke-width="1.6" style="animation-duration:${d}s;animation-delay:-${r(0, d)}s"/>`; }).join("");
    if (kind === "snow") s += Array.from({ length: 60 }, () => { const d = r(5, 10); return `<circle class="flake" cx="${r(0, W)}" cy="0" r="${r(1.5, 3.5)}" fill="#fff" opacity=".9" style="animation-duration:${d}s;animation-delay:-${r(0, d)}s"/>`; }).join("");
    if (kind === "storm") s += `<rect class="flash" width="${W}" height="${H}" fill="#fff"/><path class="flash" d="M420 60 l-30 70 h26 l-22 70 l60 -95 h-28 l24 -45z" fill="#ffe680"/>`;
    if (hot) s += Array.from({ length: 5 }, (_, i) => `<path class="heatwave" style="animation-delay:${i * .5}s" d="M0 ${240 + i * 14} q 40 -10 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0" stroke="rgba(255,220,180,.35)" stroke-width="2" fill="none"/>`).join("");
    s += `<path d="M0 300 L0 262 h30 v-18 h22 v18 h18 v-30 h26 v30 h14 v-44 h18 v44 h24 v-22 h30 v22 h20 v-52 l12 -14 l12 14 v52 h26 v-30 h34 v30 h18 v-64 h22 v64 h16 v-26 h28 v26 h20 v-40 h18 v40 h30 v-20 h24 v20 h18 v-58 h8 v-14 h8 v14 h8 v58 h26 v-28 h30 v28 h20 v-36 h22 v36 h20 V300 Z" fill="rgba(6,14,24,.35)"/>`;
    return s + "</svg>";
  }

  // ---------- semicircle gauge ----------
  // segs: [[upTo, color], ...] across [min,max]
  function gauge({ min = 0, max = 300, segs, label = "", value = null, display }) {
    const cx = 120, cy = 120, R = 92, a0 = Math.PI, toA = v => a0 - (Math.min(max, Math.max(min, v)) - min) / (max - min) * Math.PI;
    const pt = a => [cx + R * Math.cos(a), cy - R * Math.sin(a)];
    let prev = min, arcs = "";
    segs.forEach(([upTo, col]) => { const [x1, y1] = pt(toA(prev)), [x2, y2] = pt(toA(upTo)); arcs += `<path class="arc-seg" d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}" stroke="${col}"/>`; prev = upTo; });
    const el = document.createElement("div");
    el.innerHTML = `<svg class="gauge" viewBox="0 0 240 176" role="img" aria-label="${U.esc(label)}"><path class="arc-bg" d="M28 120 A92 92 0 0 1 212 120"/>${arcs}
      <g class="needle" style="transform:rotate(-90deg)"><line x1="120" y1="120" x2="120" y2="40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="120" cy="120" r="8" fill="currentColor"/></g>
      <text class="val" x="120" y="153" text-anchor="middle">—</text><text class="lbl" x="120" y="171" text-anchor="middle">${U.esc(label)}</text></svg>`;
    const svg = el.firstElementChild, needle = svg.querySelector(".needle"), txt = svg.querySelector(".val");
    svg.style.color = "var(--ink)";
    svg.set = v => {
      if (v == null) { txt.textContent = "—"; return; }
      const deg = -90 + (Math.min(max, Math.max(min, v)) - min) / (max - min) * 180;
      requestAnimationFrame(() => { needle.style.transform = `rotate(${deg}deg)`; });
      const from = +svg.dataset.v || 0; svg.dataset.v = v; const t0 = performance.now();
      const show = x => txt.textContent = display ? display(x) : Math.round(x);
      if (reduce) return show(v);
      const step = t => { const k = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - k, 3); show(from + (v - from) * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    if (value != null) setTimeout(() => svg.set(value), 60);
    return svg;
  }

  // ---------- thermometer ----------
  function thermo(value, { min = -10, max = 130, color = "#b4472f", label = "" } = {}) {
    const k = Math.max(0, Math.min(1, (value - min) / (max - min))), h = 120 * k;
    const id = "tg" + Math.random().toString(36).slice(2, 7);
    return `<svg class="thermo" viewBox="0 0 60 170" width="54" height="150" role="img" aria-label="${U.esc(label)}">
      <defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3d7fb2"/><stop offset=".55" stop-color="#e8a91b"/><stop offset="1" stop-color="#9e2f3c"/></linearGradient></defs>
      <rect x="22" y="10" width="16" height="130" rx="8" fill="var(--surface-2)" stroke="var(--line)"/>
      <circle cx="30" cy="148" r="16" fill="${color}"/>
      <rect class="fill" x="25" y="${140 - h}" width="10" height="${h + 6}" rx="5" fill="url(#${id})" style="height:0;y:140px"></rect>
      ${[0, .25, .5, .75, 1].map(t => `<line x1="40" x2="46" y1="${140 - 120 * t}" y2="${140 - 120 * t}" stroke="var(--line)"/>`).join("")}
    </svg>`;
  }
  function growThermo(root) { U.$$(".thermo .fill", root).forEach(r => { const y = r.getAttribute("y"), h = r.getAttribute("height"); requestAnimationFrame(() => requestAnimationFrame(() => { r.style.y = y + "px"; r.style.height = h + "px"; })); }); }

  // ---------- donut ring ----------
  function ring(pct, color) {
    const C = 2 * Math.PI * 34, off = C * (1 - (pct ?? 0) / 100);
    return `<svg viewBox="0 0 84 84" aria-hidden="true"><circle class="bg" cx="42" cy="42" r="34"/><circle class="fg" cx="42" cy="42" r="34" stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/></svg>`;
  }
  function growRings(root) { U.$$(".ring .fg", root).forEach(c => requestAnimationFrame(() => requestAnimationFrame(() => c.style.strokeDashoffset = c.dataset.off))); }

  // ---------- sun path ----------
  function sunPath(rise, set, now = new Date()) {
    const k = Math.max(0, Math.min(1, (now - rise) / (set - rise))), up = now > rise && now < set;
    const a = Math.PI * (1 - k), x = 100 + 80 * Math.cos(a), y = 92 - 70 * Math.sin(a);
    return `<svg class="sunpath" viewBox="0 0 200 110" width="100%" style="max-width:240px;display:block;margin:6px auto 0" aria-hidden="true">
      <path d="M20 92 A80 70 0 0 1 180 92" fill="none" stroke="var(--line)" stroke-width="2" stroke-dasharray="4 5"/>
      <line x1="8" x2="192" y1="92" y2="92" stroke="var(--line)"/>
      <circle class="sundot" cx="20" cy="92" r="${up ? 9 : 6}" fill="${up ? "#f2b53b" : "var(--ink-2)"}" data-x="${x}" data-y="${y}"/>
    </svg>`;
  }
  function moveSun(root) { U.$$(".sundot", root).forEach(c => requestAnimationFrame(() => requestAnimationFrame(() => { c.setAttribute("cx", c.dataset.x); c.setAttribute("cy", c.dataset.y); }))); }

  // ---------- small weather icons ----------
  function icon(code, isDay = 1, size = 28) {
    const k = LIVE.sky(code);
    const sun = `<circle cx="16" cy="16" r="7" fill="#f2b53b"/>`, moon = `<path d="M19 9a8 8 0 1 0 5 13a7 7 0 0 1-5-13z" fill="#c9d3e0"/>`;
    const cloud = c => `<path d="M10 25h15a5 5 0 0 0 0-10a7 7 0 0 0-13-1a5 5 0 0 0-2 11z" fill="${c}"/>`;
    let g = k === "clear" ? (isDay ? sun : moon) : k === "cloudy" ? (code === 3 ? cloud("#aab7c4") : (isDay ? `<g transform="translate(-4 -4)">${sun}</g>` : `<g transform="translate(-4 -4)">${moon}</g>`) + cloud("#d6dee6")) :
      k === "fog" ? `<g stroke="#aab7c4" stroke-width="3" stroke-linecap="round"><line x1="6" x2="26" y1="12" y2="12"/><line x1="4" x2="24" y1="18" y2="18"/><line x1="8" x2="28" y1="24" y2="24"/></g>` :
      k === "rain" ? cloud("#9fb0c0") + `<g stroke="#2f7fb5" stroke-width="2" stroke-linecap="round"><line x1="12" y1="27" x2="11" y2="31"/><line x1="18" y1="27" x2="17" y2="31"/><line x1="24" y1="27" x2="23" y2="31"/></g>` :
      k === "snow" ? cloud("#b8c6d3") + `<g fill="#7fb0d8"><circle cx="12" cy="29" r="1.6"/><circle cx="18" cy="30" r="1.6"/><circle cx="24" cy="29" r="1.6"/></g>` :
      cloud("#7d8796") + `<path d="M17 24l-4 6h4l-2 5l6-8h-4l2-3z" fill="#f2c14e"/>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 34" aria-hidden="true">${g}</svg>`;
  }

  // ---------- refresh countdown rings ----------
  function refreshBadge(feedId) {
    return `<span class="refresh" data-feed="${feedId}" title="Refreshes automatically"><svg viewBox="0 0 20 20"><circle class="bg" cx="10" cy="10" r="7"/><circle class="fg" cx="10" cy="10" r="7" stroke-dasharray="44" stroke-dashoffset="44"/></svg><span class="ago">…</span></span>`;
  }
  setInterval(() => {
    U.$$(".refresh[data-feed]").forEach(b => {
      const f = LIVE.feeds[b.dataset.feed]; if (!f) return;
      b.classList.toggle("busy", f.busy);
      const k = f.next ? Math.max(0, Math.min(1, 1 - (f.next - Date.now()) / f.every)) : 0;
      b.querySelector(".fg").style.strokeDashoffset = 44 * (1 - k);
      b.querySelector(".ago").textContent = f.busy ? "updating" : f.at ? "updated " + U.timeAgo(f.at) : f.err ? "offline" : "…";
    });
  }, 1000);

  return { reveal, onReveal, countUp, scene, gauge, thermo, growThermo, ring, growRings, sunPath, moveSun, icon, refreshBadge, reduce };
})();
