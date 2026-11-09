/* English / Español for the resident pages (Today, Plan, My block, Map, Help).
   Pages are written in English; in Spanish mode every visible phrase is looked up in ES_DICT
   (numbers are matched as "#" and put back), then in ES_PATTERNS for sentences built from parts.
   The Data and research pages stay in English. Names of places, streets and programs are left as they are. */
const LOC = () => (typeof I18N !== "undefined" && I18N.lang() === "es") ? "es-US" : "en-US";   // date and time formatting
const I18N = (() => {
  let lang = "en";
  try { lang = localStorage.getItem("ccp.lang") || (navigator.language || "").toLowerCase().startsWith("es") && "es" || "en"; } catch {}
  const es = () => lang === "es";
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);
  const ENGLISH_ONLY = "#v-explore,#v-compare,#v-correlate,#v-live,#v-download,#v-refs,#v-about,#v-brief,#v-status,[data-no-i18n],.leaflet-control-attribution";
  const miss = new Set();
  const NUM = /\d+(?:[.,]\d+)*/g;

  // Spanish times match the browser's es-US format: "9 AM" -> "9 a.m."
  const polish = s => s.replace(/\b(\d{1,2})(:\d{2})? ?AM\b/g, "$1$2 a.m.").replace(/\b(\d{1,2})(:\d{2})? ?PM\b/g, "$1$2 p.m.");

  function t(src) {
    if (!es() || src == null) return src;
    const raw = String(src), core = raw.trim(); if (!core || !/[A-Za-z]/.test(core) || /[áéíóúñ¿¡]/i.test(core)) return raw;
    const lead = raw.slice(0, raw.indexOf(core[0])), trail = raw.slice(raw.lastIndexOf(core[core.length - 1]) + 1);
    const key = core.replace(/\s+/g, " ");
    let out = (typeof ES_DICT !== "undefined" && ES_DICT[key]) || null;
    if (out == null) {   // numbers as placeholders
      const nums = key.match(NUM) || []; const k2 = key.replace(NUM, "#");
      const hit = nums.length && ES_DICT[k2];
      if (hit) { let i = 0; out = hit.replace(/#/g, () => nums[i++] ?? "#"); }
    }
    if (out == null) for (const [re, fn] of (typeof ES_PATTERNS !== "undefined" ? ES_PATTERNS : [])) { const m = key.match(re); if (m) { out = typeof fn === "function" ? fn(m, t) : key.replace(re, fn); break; } }
    if (out == null) { if (/[a-z]{3,}/.test(key)) miss.add(key); return raw; }
    return lead + polish(out) + trail;
  }

  const done = new WeakMap();   // node -> the Spanish text we wrote, so we never translate twice
  function applyNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentElement; if (!p || SKIP.has(p.tagName) || p.closest(ENGLISH_ONLY)) return;
      if (done.get(n) === n.nodeValue) return;
      const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; done.set(n, n.nodeValue); return;
    }
    if (n.nodeType !== 1 || SKIP.has(n.tagName) || n.closest?.(ENGLISH_ONLY)) return;
    for (const a of ["placeholder", "aria-label", "title"]) if (n.hasAttribute(a)) { const v = n.getAttribute(a), w = t(v); if (w !== v) n.setAttribute(a, w); }
    for (const c of n.childNodes) applyNode(c);
  }
  let q = new Set(), h = 0;
  const flush = () => { h = 0; const nodes = [...q]; q.clear(); nodes.forEach(n => n.isConnected && applyNode(n)); };
  function watch() {
    applyNode(document.body);
    new MutationObserver(ms => { ms.forEach(m => { if (m.type === "characterData") q.add(m.target); else m.addedNodes.forEach(x => q.add(x)); if (m.type === "attributes") q.add(m.target); }); if (!h) h = requestAnimationFrame(flush); })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
  }

  function set(l) { try { localStorage.setItem("ccp.lang", l); } catch {} location.reload(); }
  function init() {
    document.documentElement.lang = lang;
    const hdr = document.querySelector(".hdr-actions");
    if (hdr && !document.getElementById("langBtn")) {
      hdr.insertAdjacentHTML("afterbegin", `<button class="langbtn" id="langBtn" lang="${es() ? "en" : "es"}" aria-label="${es() ? "Switch to English" : "Ver en español"}" title="${es() ? "English" : "Español"}">${es() ? "EN" : "ES"}</button>`);
      document.getElementById("langBtn").onclick = () => set(es() ? "en" : "es");
    }
    if (!es()) return;
    document.querySelectorAll("section.view [data-sub]").forEach(s => {
      if (s.closest(ENGLISH_ONLY) && !s.parentElement.querySelector(".en-note")) s.insertAdjacentHTML("afterend", `<p class="en-note" lang="es">Las páginas de datos están en inglés.</p>`); });
    watch();
  }
  return { t, init, set, lang: () => lang, miss };
})();
