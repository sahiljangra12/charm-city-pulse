/* Live alerts: a bottom sheet with BMORE Alert sign-up (city text/call/email) and on-device notifications
   from this app for NWS warnings, unhealthy air, dangerous heat and dangerous cold. */
const ALERTS = (() => {
  const supported = "Notification" in window;
  const prefs = () => U.store.get("notifyPrefs", { nws: true, air: true, heat: true, cold: true });
  const enabled = () => supported && Notification.permission === "granted" && U.store.get("notify", false);
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    U.$("#sheetBack").classList.add("on"); const s = U.$("#alertSheet"); s.classList.add("on"); s.setAttribute("aria-hidden", "false");
    sync(); setTimeout(() => U.$("#sheetClose").focus(), 300);
    document.addEventListener("keydown", esc);
  }
  function close() {
    U.$("#sheetBack").classList.remove("on"); const s = U.$("#alertSheet"); s.classList.remove("on"); s.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", esc); if (lastFocus) lastFocus.focus();
  }
  const esc = e => { if (e.key === "Escape") close(); };
  function sync() {
    const sw = U.$("#notifSwitch"), st = U.$("#notifState");
    sw.setAttribute("aria-checked", String(enabled()));
    U.$("#alertBtn").classList.toggle("on", enabled());
    U.$("#notifPrefs").style.display = enabled() ? "block" : "none";
    if (!supported) { sw.disabled = true; st.textContent = "This browser can't show notifications. On iPhone, add Charm City Pulse to your Home Screen first (Share, then Add to Home Screen), then open it from there."; }
    else if (Notification.permission === "denied") st.textContent = "Notifications are blocked for this site. Allow them in your browser's site settings, then turn this on.";
    U.$$("#notifPrefs [data-pref]").forEach(c => { c.checked = !!prefs()[c.dataset.pref]; c.onchange = () => U.store.set("notifyPrefs", { ...prefs(), [c.dataset.pref]: c.checked }); });
  }
  async function toggle() {
    if (!supported) return;
    if (enabled()) { U.store.set("notify", false); sync(); U.toast("Notifications on this device are off."); return; }
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (p === "granted") { U.store.set("notify", true); sync(); notify("Alerts are on", "You'll be notified about weather warnings, unhealthy air, and dangerous heat or cold in Baltimore.", "welcome"); check(); }
    else { sync(); U.toast("Notifications weren't allowed. You can still sign up for BMORE Alert texts and emails."); }
  }
  async function notify(title, body, tag) {
    const opts = { body, tag, icon: "icon.svg", badge: "icon.svg", renotify: false };
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { reg.showNotification(title, opts); return; } } catch {}
    try { new Notification(title, opts); } catch {}
  }
  // one notification per event per day
  function once(key, title, body) {
    const seen = U.store.get("notifySeen", {}), today = new Date().toISOString().slice(0, 10), k = key + "|" + today;
    if (seen[k]) return; seen[k] = 1;
    Object.keys(seen).forEach(x => { if (!x.endsWith(today) && !x.startsWith("nws:")) delete seen[x]; });
    U.store.set("notifySeen", seen); notify(title, body, key);
  }
  function check() {
    if (!enabled()) return; const P = prefs();
    const AL = LIVE.feeds.alerts.value || [];
    if (P.nws) AL.forEach(a => once("nws:" + (a.id || a.event + a.onset), a.event, a.headline || "Active for Baltimore. Open Charm City Pulse for details."));
    const aq = RES.aqiNow().aqi;
    if (P.air && aq != null && aq > 100) once("air", "Air is " + LIVE.aqiCat(aq).t.toLowerCase(), LIVE.aqiCat(aq).tip);
    const c = LIVE.feeds.weather.value?.current;
    if (c) {
      const fc = LIVE.feelsCat(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m);
      if (P.heat && fc?.kind === "heat" && fc.index >= 103) once("heat", `Heat index ${U.tF(fc.index)} in Baltimore`, "Dangerous heat. Stay somewhere cool, drink water, and check on neighbors. Call 311 for cooling centers.");
      if (P.cold && fc?.kind === "cold" && fc.index <= 13) once("cold", `Wind chill ${U.tF(fc.index)} in Baltimore`, "Code Blue cold. Warming centers and shelters are open: Shelter Hotline 443-984-9540.");
    }
  }
  function init() {
    U.$("#alertBtn").onclick = open; U.$("#sheetClose").onclick = close; U.$("#sheetBack").onclick = close;
    U.$("#notifSwitch").onclick = toggle;
    // swipe down to close (phones)
    const sh = U.$("#alertSheet"); let y0 = null;
    sh.addEventListener("touchstart", e => { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener("touchmove", e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translate(-50%,${dy}px)`; }, { passive: true });
    sh.addEventListener("touchend", e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; sh.style.transform = ""; y0 = null; if (dy > 110) close(); });
    sync();
    ["alerts", "weather", "air", "airnow"].forEach(k => LIVE.feeds[k].on(check));
  }
  return { init, open };
})();
