// Opens every page of the site in a headless browser and fails if any page throws a script error,
// shows leftover code (like "${...}", "undefined", "NaN" or "[object Object]"), or renders empty.
// Run: node tests/smoke.mjs http://localhost:8765/   (LIBS=/path/to/node_modules serves the map/chart libraries offline)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8765/";
const LIBS = process.env.LIBS;
const VIEWS = ["today", "today/details", "plan", "place/24510120400", "map", "help", "guide", "alerts", "brief", "explore", "compare", "correlate", "live", "download", "refs", "about", "status", "now", "methods", "nb/Midway%2FColdstream"];
const LEAK = /.{0,40}(\$\{|\bundefined\b|\bNaN\b|\[object Object\]).{0,40}/g;
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const problems = [];
for (const lang of ["en", "es"]) {
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp, timezoneId: "America/New_York" });
    await ctx.addInitScript(l => { try { localStorage.setItem("ccp.lang", l); localStorage.setItem("ccp.welcomed", "1"); } catch (e) {} }, lang);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
    if (LIBS) await page.route("**/*", r => {
      const u = r.request().url();
      if (u.endsWith("leaflet.min.js")) return r.fulfill({ path: LIBS + "/leaflet/dist/leaflet.js" });
      if (u.endsWith("chart.umd.min.js")) return r.fulfill({ path: LIBS + "/chart.js/dist/chart.umd.js" });
      if (u.endsWith("esri-leaflet.js")) return r.fulfill({ path: LIBS + "/esri-leaflet/dist/esri-leaflet.js" });
      return u.startsWith(BASE) ? r.continue() : r.abort();
    });
    for (const v of VIEWS) {
      const at = `${lang} ${vp.width}px #${v}`;
      errs.length = 0;
      try { await page.goto(BASE + "#" + v, { waitUntil: "domcontentloaded", timeout: 30000 }); } catch (e) { problems.push(`${at}: did not load (${e.message.slice(0, 80)})`); continue; }
      await page.waitForTimeout(2500);
      // exercise the interactive parts too: every indicator on Explore, every rank on the brief, all map buttons
      const extra = (lang !== "en" || vp.width !== 1280) ? [] : await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms)), seen = [], grab = () => { const t = document.body.innerText; const m = t.match(/.{0,40}(\$\{|\bundefined\b|\bNaN\b|\[object Object\]).{0,40}/); if (m) seen.push(m[0]); };
        const cycle = async sel => { const s = document.querySelector(sel); if (!s) return; for (const o of [...s.options]) { s.value = o.value; s.dispatchEvent(new Event("change")); await wait(120); grab(); } };
        const v = location.hash.slice(1);
        if (v === "explore") for (const g of ["tract", "csa"]) { document.querySelector(`[data-geo-level=${g}]`)?.click(); await wait(300); await cycle("#exInd"); }
        if (v === "brief") await cycle("#bRank");
        if (v === "compare" || v === "correlate") for (const s of document.querySelectorAll(`#v-${v} select`)) await cycle("#" + s.id);
        if (v === "map") { for (const b of document.querySelectorAll("#mapChips .chipbtn")) { b.click(); await wait(400); grab(); } await cycle("#mapColor"); }
        return seen.slice(0, 3);
      });
      if (extra.length) problems.push(`${at}: leftover code after using the page: ${extra.map(s => JSON.stringify(s.trim())).join(" | ")}`);
      const r = await page.evaluate(() => {
        const sec = document.querySelector("section.view.on, section.view.active, section.view:not([hidden])[aria-hidden='false']") || [...document.querySelectorAll("section.view")].find(s => s.offsetParent !== null);
        const text = document.body.innerText + " " + [...document.querySelectorAll("[title],[aria-label]")].map(e => (e.getAttribute("title") || "") + " " + (e.getAttribute("aria-label") || "")).join(" ");
        return { text, len: sec ? sec.innerText.trim().length : 0, wide: document.documentElement.scrollWidth - innerWidth };
      });
      const leaks = (r.text.match(LEAK) || []).slice(0, 3);
      if (leaks.length) problems.push(`${at}: leftover code on the page: ${leaks.map(s => JSON.stringify(s.trim())).join(" | ")}`);
      if (r.len < 40) problems.push(`${at}: page looks empty`);
      if (r.wide > 4) problems.push(`${at}: page scrolls sideways by ${r.wide}px`);
      if (errs.length) problems.push(`${at}: script error: ${errs[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
if (problems.length) { console.log("SMOKE TEST FAILED\n" + problems.map(p => " - " + p).join("\n")); process.exit(1); }
console.log(`Smoke test passed: ${VIEWS.length} pages x 2 languages x 2 screen sizes.`);
