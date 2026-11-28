/* Emergency banner on the opening page (Today) only.
   Shows the most serious active alert in a bar that slides down under the header:
   Code Blue / Code Red (Health Department), snow emergency (Transportation), boil-water notice (Public Works),
   and National Weather Service warnings, watches and advisories. Dismissing hides that alert until a new one arrives. */
const BANNER = (() => {
  const KEY = "dismissedAlerts";
  let el, list = [];

  function collect() {
    const out = [], city = LIVE.feeds.city.value, nws = LIVE.feeds.alerts.value || [];
    const red = LIVE.cityAlert("red"), blue = LIVE.cityAlert("blue"), snow = LIVE.snowEmergency();
    if (blue) out.push({ id: "blue:" + blue.posted, s: 99, tone: "blue", icon: "snow", title: "Code Blue: extreme cold", text: "Emergency shelters are open. Need a bed? Call the Shelter Hotline.", act: ["Call 443-984-9540", "tel:4439849540"] });
    if (red) out.push({ id: "red:" + red.posted, s: 99, tone: "red", icon: "thermo", title: "Code Red: extreme heat", text: "Cooling centers are open. Drink water and check on older neighbors.", act: ["Find a cool place", "#help/sec-places"] });
    (city?.water || []).filter(n => n.kind === "boil").forEach(n => out.push({ id: "boil:" + n.posted, s: 97, tone: "red", icon: "droplet", title: "Boil-water advisory", text: n.title, act: ["Read the notice", n.url] }));
    if (snow) out.push({ id: "snow:" + snow.posted, s: 96, tone: "blue", icon: "car", title: "Snow emergency declared", text: "Move cars off snow emergency routes: $52 ticket and towing.", act: ["See snow routes", "#map"] });
    nws.filter(a => /Warning|Watch|Advisory|Emergency/i.test(a.event || "") && !/Test/i.test(a.event || "")).forEach(a => {
      const sev = /Extreme/.test(a.severity) ? 95 : /Severe/.test(a.severity) ? 90 : /Moderate/.test(a.severity) ? 70 : 60;
      const heat = /heat/i.test(a.event), cold = /cold|chill|freez|winter|snow|ice|blizzard/i.test(a.event), flood = /flood/i.test(a.event);
      out.push({ id: "nws:" + (a.id || a.event + a.onset), s: sev + (/Warning|Emergency/i.test(a.event) ? 4 : 0), tone: sev >= 90 || /Warning|Emergency/i.test(a.event) ? "red" : "amber",
        icon: heat ? "thermo" : cold ? "snow" : flood ? "waves" : "alert", title: a.event,
        text: (a.ends || a.expires) ? `In effect for Baltimore until ${new Date(a.ends || a.expires).toLocaleString(LOC(), { weekday: "long", hour: "numeric", minute: "2-digit" })}.` : "In effect for Baltimore.",
        act: heat ? ["Find a cool place", "#help/sec-places"] : cold ? ["Find a warm place", "#help/sec-places"] : flood ? ["Check my block", "#place"] : ["What to do", "#prioAnchor"] });
    });
    return out.sort((a, b) => b.s - a.s);
  }

  const dismissed = () => U.store.get(KEY, []);
  const onToday = () => (location.hash.slice(1).split("/")[0] || "today") === "today";

  function render() {
    if (!el) return;
    const gone = new Set(dismissed());
    list = collect().filter(a => !gone.has(a.id));
    const show = onToday() && list.length > 0;
    document.documentElement.classList.toggle("has-banner", show);
    if (!show) { el.hidden = true; el.classList.remove("in"); document.documentElement.style.removeProperty("--banner-h"); return; }
    const a = list[0], more = list.length - 1, ext = /^https?:/.test(a.act[1]);
    el.className = `em-banner ${a.tone}`;
    el.innerHTML = `<div class="em-in" role="alert">
        <span class="em-ic">${I(a.icon, 22)}</span>
        <div class="em-txt"><b>${U.esc(a.title)}</b><span>${U.esc(a.text)}${more ? ` <a href="#prioAnchor" class="em-more">+${more} more alert${more > 1 ? "s" : ""}</a>` : ""}</span></div>
        <a class="em-act" href="${U.esc(a.act[1])}"${ext ? ' target="_blank" rel="noopener"' : ""}>${U.esc(a.act[0])}</a>
        <button class="em-x" aria-label="Dismiss this alert">${I("x", 18)}</button></div>`;
    el.hidden = false;
    el.querySelector(".em-x").onclick = () => { U.store.set(KEY, [...dismissed(), a.id].slice(-40)); render(); };
    requestAnimationFrame(() => { el.classList.add("in"); document.documentElement.style.setProperty("--banner-h", el.offsetHeight + "px"); });
  }

  function init() {
    el = document.createElement("div"); el.id = "emBanner"; el.hidden = true;
    document.body.appendChild(el);
    ["city", "alerts"].forEach(k => LIVE.feeds[k].on(render));
    addEventListener("hashchange", render);
    addEventListener("resize", () => { if (!el.hidden) document.documentElement.style.setProperty("--banner-h", el.offsetHeight + "px"); });
    render();
  }
  return { init, render, collect };
})();
