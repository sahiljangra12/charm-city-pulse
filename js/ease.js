/* Things that make the site easier for everyone:
   - "Get help now": one screen of big buttons for someone in trouble (#now)
   - Saved places: home, work, a parent's house, switchable on My block
   - Read aloud: reads the current page with the phone's built-in voice
   - Other languages: opens the site through Google Translate (machine translation)
   - Report a mistake: a prefilled report, so wrong hours or places get fixed
   - Visitor counts: cookie-free counting with GoatCounter, only when CONFIG.goatcounter is set */
const CONFIG = {
  contact: "",          // an email address for "Report a mistake"; empty = GitHub issue form only
  goatcounter: "",      // GoatCounter site code (e.g. "charmcitypulse") for cookie-free visitor counts; empty = off
  repo: "https://github.com/sahiljangra12/charm-city-pulse",
};

const EASE = (() => {
  const tile = (ic, c) => `<span class="tile" style="--tc:${c}">${I(ic, 26)}</span>`;

  // ---------------- Get help now ----------------
  function nowShow() {
    const loc = U.store.get("loc", null), s = LIVE.season();
    const near = (list) => loc ? list.map(x => ({ ...x, d: U.km([loc.lon, loc.lat], [x.lon, x.lat]) })).sort((a, b) => a.d - b.d)[0] : null;
    const C = APP.data.centers, warm = C.winter.sites.filter(x => x.lat != null), cool = C.cooling;
    const place = near(s === "summer" ? cool : warm.length ? warm : cool);
    const dir = place ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}` : "#help/sec-places";
    const B = [
      ["tel:911", "alert", "var(--red)", "Call 911", "Someone is hurt, very sick, or in danger", true],
      ["tel:4439849540", "bed", "var(--s3)", "I need a bed tonight", "Baltimore Shelter Hotline, 443-984-9540"],
      [dir, s === "summer" ? "snow" : "flame", "var(--link)", s === "summer" ? "I need to cool off" : "I need to get warm", place ? `Closest: ${place.name}, ${U.dist(place.d)} away. Tap for directions.` : "See warming and cooling places"],
      ["tel:211", "hands", "var(--s0)", "I need food, rent or bill help", "211 Maryland, any time, any language"],
      ["tel:988", "heart", "#6b4c9a", "I need someone to talk to", "988 Suicide & Crisis Lifeline, call or text, 24/7"],
      ["tel:18777782222", "bolt", "var(--accent)", "My power is out", "BGE outages, 1-877-778-2222. Gas smell: leave, then call 1-800-685-0123"],
      ["tel:311", "building", "var(--ink-2)", "Report a city problem", "No heat, flooding, a downed tree: Baltimore 311"],
      [MORE.neighborText(s === "summer" ? "heat" : s === "winter" ? "cold" : "help"), "phone", "var(--s0)", "Check on a neighbor", "Send a text with the help numbers"],
    ];
    U.$("#nowList").innerHTML = B.map(([h, ic, c, t, d, urgent]) => `<a class="nowbtn${urgent ? " urgent" : ""}" href="${U.esc(h)}"${h.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${tile(ic, c)}<span><b>${t}</b><small>${U.esc(d)}</small></span>${I("chev", 22)}</a>`).join("");
  }

  // ---------------- Saved places ----------------
  const places = () => U.store.get("places", []);
  function savedBar(el, current) {
    if (!el) return;
    const list = places(), cur = current && list.find(p => Math.abs(p.lat - current.lat) < 1e-4 && Math.abs(p.lon - current.lon) < 1e-4);
    el.innerHTML = `<div class="saved">${list.length ? `<span class="muted">Saved:</span>` : ""}${list.map((p, i) => `<button class="chipbtn small" data-sp="${i}" aria-pressed="${cur === p}">${I(p.name === "Home" ? "home" : "pin", 16)}${U.esc(p.name)}</button>`).join("")}
      ${current && !cur ? `<span class="savewrap"><span class="muted">Save this place as</span>${["Home", "Work", "Family", "Other"].map(n => `<button class="chipbtn small" data-save="${n}">${n}</button>`).join("")}</span>` : ""}
      ${cur ? `<button class="linkbtn" data-unsave>Remove "${U.esc(cur.name)}"</button>` : ""}</div>`;
    el.querySelectorAll("[data-sp]").forEach(b => b.onclick = () => { const p = list[+b.dataset.sp]; RES.pick(p.lat, p.lon, p.label || p.name); });
    el.querySelectorAll("[data-save]").forEach(b => b.onclick = () => {
      const n = b.dataset.save, others = list.filter(p => p.name !== n || n === "Other");
      U.store.set("places", [...others, { name: n, lat: current.lat, lon: current.lon, label: current.label }].slice(-6));
      U.toast(`Saved as ${n}. It's on this device only.`); savedBar(el, current); });
    el.querySelector("[data-unsave]")?.addEventListener("click", () => { U.store.set("places", list.filter(p => p !== cur)); savedBar(el, current); });
  }

  // ---------------- Read aloud ----------------
  const synth = window.speechSynthesis;
  let speaking = false;
  function readText() {
    const v = document.querySelector("section.view.on"); if (!v) return "";
    const skip = "nav, .jumpbar, table, .leaflet-container, .mapwrap, script, style, [hidden], details:not([open]) > :not(summary), .report-actions, .flagwave, .skeleton, button";
    const clone = v.cloneNode(true); clone.querySelectorAll(skip).forEach(n => n.remove());
    return clone.innerText.replace(/\s*\n\s*/g, ". ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim().slice(0, 6000);
  }
  function speak() {
    if (!synth) { U.toast("Read aloud isn't available in this browser."); return; }
    if (speaking) { synth.cancel(); speaking = false; mark(); return; }
    const lang = I18N.lang() === "es" ? "es-US" : "en-US", text = readText(); if (!text) return;
    const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
    synth.cancel(); speaking = true; mark();
    parts.forEach((p, i) => { const u = new SpeechSynthesisUtterance(p.trim()); u.lang = lang; u.rate = .95; if (i === parts.length - 1) u.onend = () => { speaking = false; mark(); }; synth.speak(u); });
  }
  const mark = () => document.querySelectorAll("[data-speak]").forEach(b => { b.setAttribute("aria-pressed", String(speaking)); const s = b.querySelector("span"); if (s) s.textContent = speaking ? "Stop reading" : "Read aloud"; });

  // ---------------- Other languages (machine translation) ----------------
  const LANGS = [["zh-CN", "中文 (Chinese)"], ["fr", "Français (French)"], ["ko", "한국어 (Korean)"], ["am", "አማርኛ (Amharic)"], ["ar", "العربية (Arabic)"], ["ru", "Русский (Russian)"], ["vi", "Tiếng Việt (Vietnamese)"], ["yo", "Yorùbá (Yoruba)"]];
  function translateUrl(tl) {
    const host = location.hostname.replace(/-/g, "--").replace(/\./g, "-");
    return `https://${host}.translate.goog${location.pathname}?_x_tr_sl=en&_x_tr_tl=${tl}&_x_tr_hl=${tl}${location.hash}`;
  }
  const langMenu = () => `<details class="langmenu"><summary>${I("search", 16)}<span>Other languages</span></summary><div>${LANGS.map(([c, n]) => `<a href="${translateUrl(c)}" lang="${c}" rel="noopener">${n}</a>`).join("")}<small>Machine translation by Google. Spanish (ES button) is translated by hand.</small></div></details>`;

  // ---------------- Report a mistake ----------------
  function reportUrl() {
    const t = `Mistake on ${(location.hash.slice(1) || "today").split("/")[0]} page`;
    const b = `Page: ${location.href}\n\nWhat is wrong (for example, wrong hours, a place that closed, a wrong phone number):\n\n\nWhat it should say (if you know):\n`;
    return `${CONFIG.repo}/issues/new?labels=mistake&title=${encodeURIComponent(t)}&body=${encodeURIComponent(b)}`;
  }
  function reportMistake() {
    const mail = CONFIG.contact ? `mailto:${CONFIG.contact}?subject=${encodeURIComponent("Charm City Pulse: mistake report")}&body=${encodeURIComponent("Page: " + location.href + "\n\nWhat is wrong:\n\n")}` : null;
    window.open(mail || reportUrl(), mail ? "_self" : "_blank", "noopener");
  }

  // ---------------- Visitor counts (cookie-free, opt-in by config) ----------------
  function count() {
    if (!CONFIG.goatcounter || navigator.doNotTrack === "1" || /localhost|127\.0\.0\.1/.test(location.hostname)) return;
    window.goatcounter = { path: p => p + location.hash.split("/")[0] };
    const s = document.createElement("script"); s.async = true; s.dataset.goatcounter = `https://${CONFIG.goatcounter}.goatcounter.com/count`; s.src = "https://gc.zgo.at/count.js"; document.head.appendChild(s);
    addEventListener("hashchange", () => window.goatcounter?.count?.({ path: location.pathname + location.hash.split("/")[0] }));
  }

  function init() {
    document.addEventListener("click", e => {
      if (e.target.closest("[data-speak]")) { e.preventDefault(); speak(); }
      if (e.target.closest("[data-mistake]")) { e.preventDefault(); reportMistake(); }
    });
    addEventListener("hashchange", () => { if (speaking) { synth.cancel(); speaking = false; mark(); } });
    document.querySelectorAll("[data-langs]").forEach(el => el.innerHTML = langMenu());
    count();
  }
  return { init, savedBar, speak, langMenu, views: { now: { show: nowShow } } };
})();
