/* Cinematic layer: full-screen photo sections, page banners, live background animation,
   the full-screen menu, and scroll-driven motion. Photos: Wikimedia Commons (credited on Sources). */
const CINEMA = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let CREDITS = []; const ready = U.getJSON("img/credits.json").then(c => CREDITS = c).catch(() => {});
  const commons = (title, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=${w}`;

  // ---------- photos: self-hosted copies, with Wikimedia as a fallback ----------
  function setImg(img) {
    const k = img.dataset.img; if (!k || img.dataset.set) return; img.dataset.set = 1;
    img.decoding = "async"; img.sizes = "100vw";
    img.srcset = `img/${k}-m.jpg 1100w, img/${k}.jpg 2400w`; img.src = `img/${k}.jpg`;
    img.addEventListener("load", () => img.classList.add("ok"), { once: true });
    img.addEventListener("error", async () => { await ready; const c = CREDITS.find(x => x.key === k); if (!c || img.dataset.fb) return; img.dataset.fb = 1;
      img.removeAttribute("srcset"); img.src = commons(c.title, innerWidth > 1100 ? 2400 : 1100); });
  }
  const loadImgs = (root = document) => U.$$("img[data-img]", root).forEach(setImg);

  // ---------- hero: day or night photo, live weather animation ----------
  let fx = { mode: "dust", tint: "255,255,255" };
  function hero(day, kind, hot, cold) {
    const h = U.$("#hSky"); h.dataset.day = day ? "1" : "0";
    fx.mode = /rain|storm/.test(kind) ? "rain" : kind === "snow" ? "snow" : "dust";
    fx.tint = hot ? "255,170,110" : cold ? "170,205,255" : "255,255,255";
    h.classList.toggle("hot", !!hot); h.classList.toggle("cold", !!cold);
  }
  function canvasFx() {
    const cv = U.$("#heroFx"); if (!cv || reduce) return; const ctx = cv.getContext("2d");
    let W, H, dpr, P = [];
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const spawn = (y) => ({ x: Math.random() * W, y: y ?? Math.random() * H, r: Math.random() * 1.6 + .4, v: Math.random() * .35 + .12, a: Math.random() * .5 + .15, ph: Math.random() * 6.28 });
    size(); addEventListener("resize", size); P = Array.from({ length: Math.round(Math.min(110, W / 12)) }, () => spawn());
    let vis = true; new IntersectionObserver(e => vis = e[0].isIntersecting).observe(cv);
    const tick = t => {
      requestAnimationFrame(tick); if (!vis || document.hidden || APP.view !== "today") return;
      ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        if (fx.mode === "rain") { p.y += 9 + p.v * 14; p.x -= 1.4; ctx.strokeStyle = `rgba(200,220,255,${p.a * .55})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2.4, p.y - 14); ctx.stroke(); }
        else if (fx.mode === "snow") { p.y += p.v * 2.2; p.x += Math.sin(t / 900 + p.ph) * .5; ctx.fillStyle = `rgba(255,255,255,${p.a + .2})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.6, 0, 6.28); ctx.fill(); }
        else { p.y -= p.v * .5; p.x += Math.sin(t / 2400 + p.ph) * .25; ctx.fillStyle = `rgba(${fx.tint},${p.a * (.6 + .4 * Math.sin(t / 700 + p.ph))})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); }
        if (p.y > H + 20 || p.y < -20 || p.x < -20 || p.x > W + 20) Object.assign(p, spawn(fx.mode === "dust" ? H + 10 : -10));
      }
    };
    requestAnimationFrame(tick);
  }

  // ---------- full-screen feature sections on the home page ----------
  const FEAT = [
    { key: "block", img: "block", eyebrow: "My block", title: "How does your block compare?", href: "#place", btn: "Check my block" },
    { key: "plan", img: "plan", eyebrow: "Plan", title: "Pick the best hours for your day", href: "#plan", btn: "Plan my day", right: true },
    { key: "places", img: "places", eyebrow: "Map", title: "Parks, pools and places to cool off", href: "#map", btn: "Open the map" },
    { key: "help", img: "help", eyebrow: "Help", title: "Help is one tap away", href: "#help", btn: "Get help", tel: ["311", "Call 311"], right: true },
    { key: "data", img: "data", eyebrow: "Open data", title: "Every number, open to everyone", href: "#explore", btn: "Explore the data", btn2: ["#refs", "Sources"] },
  ];
  function featText(k) {
    const loc = U.store.get("loc", null), id = loc && APP.data && APP.tractAt(loc.lat, loc.lon), p = id ? APP.data.byId[id].properties : null;
    if (k === "block") return p && !p.nonres ? `${p.csa}: ${RES.THEMES.heat.words[RES.level(p.t_heat)].toLowerCase()} in summer, with ${RES.THEMES.trees.words[RES.level(p.t_trees)].toLowerCase()}. See flood risk and the nearest help.` : "Summer heat, tree shade, flood risk and the nearest cooling or warming center for any Baltimore address.";
    if (k === "plan") { let w = null; try { w = PRIO.build().find(x => x.icon === "walk"); } catch {} return (w ? w.title + ". " : "") + "Walks, runs, bike rides, kids outside, yard work and gardening, scored hour by hour."; }
    if (k === "places") return "Water fountains, rail stations, bike lanes, farmers markets, community gardens, EV chargers and flood zones on one live map.";
    if (k === "help") return LIVE.season() === "winter" ? "Warming centers, shelter hotlines and help with heating bills, with a green call button for each." : "311, 211, shelter hotlines, cooling and warming centers, and help with energy bills, with a green call button for each.";
    if (k === "data") return "Census, CDC, EPA, NOAA, USGS and FEMA data for every neighborhood, rebuilt every morning and free to download.";
  }
  function features() {
    const box = U.$("#hFeatures"); if (!box) return;
    if (!box.dataset.built) {
      box.dataset.built = 1;
      box.innerHTML = FEAT.map(f => `<section class="feature bleed${f.right ? " right" : ""}" data-f="${f.key}">
        <div class="feature-bg"><img data-img="${f.img}" alt="" loading="lazy"></div>
        <div class="feature-in" data-rv><span class="eyebrow">${f.eyebrow}</span><h2>${f.title}</h2><p data-ft></p>
          <div class="cta"><a class="xbtn" href="${f.href}"><span>${f.btn}</span></a>${f.tel ? `<a class="xbtn call" href="tel:${f.tel[0]}">${I("phone", 16)}<span>${f.tel[1]}</span></a>` : ""}${f.btn2 ? `<a class="xbtn ghost" href="${f.btn2[0]}"><span>${f.btn2[1]}</span></a>` : ""}</div></div>
      </section>`).join("");
      loadImgs(box); watch(box);
    }
    U.$$("[data-f]", box).forEach(s => s.querySelector("[data-ft]").textContent = featText(s.dataset.f));
  }

  // ---------- page banners ----------
  const BANNER = { plan: "plan", place: "block", map: "places", help: "help", explore: "data", compare: "harbor", correlate: "water", live: "hero_night", download: "sunrise", refs: "harbor", about: "hero_day" };
  const EYEBROW = { plan: "Plan", place: "My block", map: "Map", help: "Help", explore: "Data", compare: "Data", correlate: "Data", live: "Data", download: "Data", refs: "Sources", about: "About" };
  function banners() {
    Object.entries(BANNER).forEach(([v, img]) => {
      const ph = U.$(`#v-${v} .pagehead`); if (!ph || ph.classList.contains("banner")) return;
      ph.classList.add("banner", "bleed");
      ph.insertAdjacentHTML("afterbegin", `<div class="banner-bg"><img data-img="${img}" alt=""></div>`);
      const h1 = ph.querySelector("h1"); h1.insertAdjacentHTML("beforebegin", `<span class="eyebrow">${EYEBROW[v]}</span>`);
      const inner = document.createElement("div"); inner.className = "banner-in"; [...ph.children].filter(c => !c.classList.contains("banner-bg")).forEach(c => inner.appendChild(c)); ph.appendChild(inner);
    });
    loadImgs();
  }

  // ---------- reveal and parallax ----------
  let io;
  function watch(root) {
    if (reduce || !("IntersectionObserver" in window)) { U.$$("[data-rv]", root).forEach(e => e.classList.add("in")); return; }
    io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .25 });
    U.$$("[data-rv]", root).forEach(e => io.observe(e));
  }
  function parallax() {
    if (reduce) return; let tk = false;
    const run = () => { tk = false; const vh = innerHeight;
      U.$$(".view.on .feature-bg img, .view.on .banner-bg img, .view.on .hero-bg").forEach(el => {
        const r = el.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh; el.style.transform = `translate3d(0,${(p * -8).toFixed(2)}%,0) scale(1.12)`; });
      document.body.classList.toggle("scrolled", scrollY > 30); };
    addEventListener("scroll", () => { if (!tk) { tk = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener("hashchange", () => setTimeout(run, 60)); run();
  }

  // ---------- full-screen menu ----------
  function menu() {
    const m = U.$("#menu"), b = U.$("#menuBtn");
    const main = [["today", "Today"], ["plan", "Plan my day"], ["place", "My block"], ["map", "Map"], ["help", "Get help"]];
    const data = [["explore", "Explore"], ["compare", "Compare"], ["correlate", "Correlate"], ["live", "Live feeds"], ["download", "Download"], ["refs", "Sources"], ["about", "About"]];
    U.$("#menuNav").innerHTML = `<div class="menu-main">${main.map(([k, t], i) => `<a href="#${k}" style="--i:${i}">${t}</a>`).join("")}</div>
      <div class="menu-sub"><span class="eyebrow">Data</span>${data.map(([k, t], i) => `<a href="#${k}" style="--i:${i + 5}">${t}</a>`).join("")}</div>
      <div class="menu-foot" style="--i:12"><button class="xbtn" id="menuAlerts">${I("bell", 16)}<span>Get alerts</span></button><a class="xbtn call" href="tel:311">${I("phone", 16)}<span>Call 311</span></a></div>`;
    const set = on => { m.classList.toggle("on", on); document.body.classList.toggle("menu-open", on); b.setAttribute("aria-expanded", String(on)); m.setAttribute("aria-hidden", String(!on)); b.setAttribute("aria-label", on ? "Close menu" : "Open menu"); };
    b.onclick = () => set(!m.classList.contains("on"));
    U.$("#menuAlerts").onclick = () => { set(false); setTimeout(() => ALERTS.open(), 200); };
    addEventListener("hashchange", () => set(false));
    addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
    const mark = () => { const v = (location.hash.slice(1) || "today").split("/")[0]; U.$$("#menuNav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + v)); };
    addEventListener("hashchange", mark); mark();
  }

  function init() {
    loadImgs(); banners(); menu(); canvasFx(); parallax(); watch(document);
  }
  const credits = () => ready.then(() => CREDITS);
  return { init, hero, features, credits, loadImgs };
})();
