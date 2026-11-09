/* Extra everyday help, shared by Today, My block, Map, Help and the City brief:
   food help, scheduled buses and trains, lead risk, how a neighborhood is changing, 311 shortcuts,
   "check on a neighbor" texts, water notices, harbor water quality and neighborhood air sensors. */
const MORE = (() => {
  const D = () => APP.data;
  const tile = (icon, color, size = 22) => `<span class="tile" style="--tc:${color}">${I(icon, size)}</span>`;
  const dirBtn = (lat, lon, name) => `<a class="round dir" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener" aria-label="Directions to ${U.esc(name)}" title="Directions">${I("nav", 18)}</a>`;
  const cache = {};
  const file = (name, opts) => cache[name] || (cache[name] = U.getJSON("data/" + name + "?d=" + (D()?.meta.built || ""), opts).catch(e => { delete cache[name]; throw e; }));
  const near = (list, lat, lon) => list.map(x => ({ ...x, d: U.km([lon, lat], [x.lon, x.lat]) })).sort((a, b) => a.d - b.d);

  // ---------- 311 shortcuts (the 311 site can't open a request type directly, so we name the one to pick) ----------
  const R311 = "https://balt311.baltimorecity.gov/citizen/s/";
  const SR = {
    heat: ["home", "No heat at home?", "Housing Inspection - Utility Systems"],
    flood: ["waves", "Street flooding?", "Flooded Street"],
    basement: ["droplet", "Water in your basement?", "Water in Basement"],
  };
  function report(kind) {
    const [ic, q, type] = SR[kind];
    return `<div class="sr311">${tile(ic, "var(--link)", 20)}<div><b>${q} Report it to 311</b><span>On the 311 site, search for <q>${type}</q>.</span></div>
      <div class="sr-btns"><a class="btn small" href="${R311}" target="_blank" rel="noopener">Open 311</a><a class="btn small alt" href="tel:311">${I("phone", 16)}<span>Call 311</span></a></div></div>`;
  }

  // ---------- check on a neighbor ----------
  function neighborText(kind) {
    const msg = kind === "cold"
      ? "Checking on you: it's dangerously cold tonight. If you need a warm place, the Baltimore Shelter Hotline is 443-984-9540, or call 311. Need anything?"
      : kind === "heat" ? "Checking on you: it's dangerously hot today. Stay somewhere cool and drink water. Cooling centers are open; call 311 for the nearest one. Need anything?"
      : "Checking on you. If you need help with food, rent or bills, 211 Maryland can help, any time. Need anything?";
    return "sms:?&body=" + encodeURIComponent(I18N.t(msg));
  }
  function neighborCard(kind) {
    return `<div class="place neighbor">${tile("heart", "var(--s4)")}<div><b>Check on a neighbor</b><small>Older neighbors and people living alone are most at risk in extreme heat and cold. Send a quick text with the numbers they need.</small></div>
      <a class="btn small" href="${neighborText(kind)}">${I("phone", 16)}<span>Text a neighbor</span></a></div>`;
  }

  // ---------- food help ----------
  async function foodNear(lat, lon, n = 4) {
    const f = await file("food.json");
    const sites = near((f.sites || []).map(s => ({ ...s, kind: "site" })), lat, lon).slice(0, 2);
    const stores = near((f.snap || []).filter(s => s.grocery).map(s => ({ ...s, kind: "snap" })), lat, lon).slice(0, n - sites.length);
    return { list: [...sites, ...stores].sort((a, b) => a.d - b.d), f };
  }
  const foodCard = x => `<div class="place">${tile(x.kind === "site" ? "hands" : "basket", x.kind === "site" ? "var(--s0)" : "#b8382b")}
    <div><b>${U.esc(x.name)}</b><small>${U.esc(x.address.replace(/, Baltimore, MD \d+/, ""))}</small><small>${x.kind === "site" ? "City food distribution site. Call 211 to confirm hours." : `Takes SNAP (EBT)${x.type ? ". " + U.esc(x.type) : ""}`}</small></div>
    <div class="go"><span class="dist tnum">${U.dist(x.d)}</span>${dirBtn(x.lat, x.lon, x.name)}</div></div>`;
  const FOOD_LINKS = `<div class="place">${tile("search", "var(--link)")}<div><b>Find a food pantry near you</b><small>The Maryland Food Bank's finder lists pantries with today's hours. 211 can also help, in any language.</small></div>
      <div class="go"><a class="round link" href="https://mdfoodbank.org/find-food/" target="_blank" rel="noopener" aria-label="Open the Maryland Food Bank finder" title="Open website">${I("ext", 18)}</a><a class="round call" href="tel:211" aria-label="Call 211" title="Call 211">${I("phone", 20)}</a></div></div>
    <div class="place">${tile("heart", "#b8382b")}<div><b>WIC for families with young children</b><small>Healthy food for pregnant women, new moms and children under 5.</small></div>
      <div class="go"><a class="round link" href="https://health.maryland.gov/phpa/wic/Pages/Home.aspx" target="_blank" rel="noopener" aria-label="Open Maryland WIC" title="Open website">${I("ext", 18)}</a></div></div>`;
  async function foodSection(el, lat, lon) {
    try { const { list } = await foodNear(lat, lon); el.innerHTML = list.map(foodCard).join("") + FOOD_LINKS; }
    catch { el.innerHTML = FOOD_LINKS; }
  }

  // ---------- buses, Light RailLink and Metro: scheduled departures ----------
  const tileKey = (lat, lon) => `${Math.floor(lat * 50)}_${Math.floor(lon * 50)}`;
  async function stopsNear(lat, lon, n = 3, maxKm = 0.5) {
    const idx = await file("transit/index.json"); const have = new Set(idx.tiles), keys = new Set();
    for (const dy of [-0.02, 0, 0.02]) for (const dx of [-0.02, 0, 0.02]) { const k = tileKey(lat + dy, lon + dx); if (have.has(k)) keys.add(k); }
    const tiles = await Promise.all([...keys].map(k => file(`transit/${k}.json`).catch(() => null)));
    const all = tiles.filter(Boolean).flatMap(t => t.stops.map(s => ({ ...s, days: t.days })));
    const byName = {};   // one entry per stop name and mode: each side of the street has its own stop
    near(all, lat, lon).filter(s => s.d <= maxKm).forEach(s => { const k = s.mode + s.name; (byName[k] = byName[k] || []).push(s); });
    return Object.values(byName).slice(0, n);
  }
  function upcoming(group, count = 3) {
    const now = new Date(), out = [];
    for (const s of group) s.days.forEach((ds, i) => {
      const base = new Date(ds + "T00:00:00"); // local midnight of that service day
      Object.entries(s.dep[i] || {}).forEach(([k, mins]) => { const [route, head] = k.split("|");
        mins.forEach(m => { const t = new Date(base.getTime() + m * 60000); if (t > now && t - now < 3 * 3600e3) out.push({ route, head, t }); }); });
    });
    const seen = new Set();
    return out.sort((a, b) => a.t - b.t).filter(x => { const k = x.route + x.head + x.t.getTime(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, count);
  }
  const MODE = { bus: ["bus", "Bus stop"], lightrail: ["train", "Light RailLink"], metro: ["train", "Metro SubwayLink"] };
  async function transitSection(el, lat, lon) {
    try {
      const groups = await stopsNear(lat, lon);
      if (!groups.length) { el.innerHTML = `<p class="note">No bus, Light RailLink or Metro stop within about a third of a mile.</p>`; return; }
      const hm = t => t.toLocaleTimeString(LOC(), { hour: "numeric", minute: "2-digit" });
      el.innerHTML = groups.map(g => { const s = g[0], next = upcoming(g), [ic, lab] = MODE[s.mode] || MODE.bus;
        return `<div class="place">${tile(ic, "#6b4c9a")}<div><b>${U.esc(s.name)}</b><small>${lab}, ${U.dist(s.d)} away</small>
          ${next.length ? `<ul class="deps">${next.map(x => `<li><span class="rt">${U.esc(x.route)}</span><span class="hd">${U.esc(x.head)}</span><span class="tm tnum">${hm(x.t)}</span></li>`).join("")}</ul>` : `<small>No more scheduled service in the next 3 hours.</small>`}</div>
          <div class="go">${dirBtn(s.lat, s.lon, s.name)}</div></div>`; }).join("") +
        `<p class="note">Scheduled times from MTA. Buses can run early or late; for live arrivals use the <a href="https://www.mta.maryland.gov/transit-app" target="_blank" rel="noopener">Transit app</a> or call 410-539-5000.</p>`;
    } catch { el.innerHTML = `<p class="note">Bus and rail schedules didn't load. <a href="https://www.mta.maryland.gov/" target="_blank" rel="noopener">MTA trip planner</a></p>`; }
  }

  // ---------- lead risk ----------
  function leadCard(p, csa) {
    const old = p.pct_pre1940, kids = latest(nonzero(csa?.lead));
    if (old == null || (old < 40 && !(kids && kids.v >= 1))) return "";
    return `<div class="place lead">${tile("alert", "var(--s3)")}<div><b>Lead paint is a risk in older homes</b>
      <small>About ${Math.round(old)}% of homes here were built before 1940, when lead paint was common.${kids ? ` In ${kids.y}, ${U.fmt(kids.v, 1)}% of children tested in this neighborhood had elevated blood lead.` : ""} Children under 6 and pregnant women are most at risk.</small>
      <small>The Health Department offers free lead testing and home visits: <a href="tel:4439842470">443-984-2470</a>. <a href="https://www.baltimorecity.gov/health/our-work/lead-poisoning-prevention/childhood-lead-poisoning-prevention" target="_blank" rel="noopener">Learn more</a></small></div></div>`;
  }

  // ---------- how a neighborhood is changing ----------
  // BNIA records suppressed or very small counts of children's lead tests as 0, so zero years are left out
  const nonzero = s => s && Object.fromEntries(Object.entries(s).filter(([, v]) => v > 0));
  const latest = s => { if (!s) return null; const ys = Object.keys(s).sort(); const y = ys[ys.length - 1]; return y ? { y, v: s[y] } : null; };
  function spark(series, unit) {
    const ys = Object.keys(series).sort(), v = ys.map(y => series[y]); if (v.length < 2) return "";
    const W = 120, H = 32, lo = Math.min(...v), hi = Math.max(...v), sx = i => 2 + i * (W - 4) / (v.length - 1), sy = x => hi === lo ? H / 2 : H - 3 - (x - lo) / (hi - lo) * (H - 6);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${v.map((x, i) => sx(i).toFixed(1) + "," + sy(x).toFixed(1)).join(" ")}"/><circle cx="${sx(v.length - 1)}" cy="${sy(v[v.length - 1])}" r="3" fill="currentColor"/></svg>`;
  }
  const TREND_ORDER = ["heat", "tree_canopy", "poverty", "vacant", "life_exp", "lead"];
  function change(key, s, meta) {
    const ys = Object.keys(s).sort(); if (ys.length < 2) return null;
    let a = s[ys[0]], b = s[ys[ys.length - 1]];
    if (ys.length >= 4) {   // 4+ years: use the fitted trend line, so one unusual year doesn't drive the change
      const x = ys.map(Number), y = ys.map(k => s[k]), mx = U.mean(x), my = U.mean(y);
      const slope = x.reduce((t, xi, i) => t + (xi - mx) * (y[i] - my), 0) / x.reduce((t, xi) => t + (xi - mx) ** 2, 0);
      a = my + slope * (x[0] - mx); b = my + slope * (x[x.length - 1] - mx);
    }
    const d = b - a, worse = d * (meta.direction || 1) > 0;
    const fmtV = x => key === "heat" ? U.tC(x, 1) : U.fmt(x, meta.unit === "years" ? 1 : 1, meta.unit === "%" ? "%" : "");
    const fmtD = key === "heat" ? U.tC(Math.abs(d), 1, true) : `${U.fmt(Math.abs(d), 1)}${meta.unit === "%" ? " points" : meta.unit === "years" ? " years" : ""}`;
    return { y0: ys[0], y1: ys[ys.length - 1], fit: ys.length >= 4, a: fmtV(a), b: fmtV(b), d: Math.abs(d) < 1e-9 ? "no change" : (d > 0 ? "up " : "down ") + fmtD, worse: Math.abs(d) < 1e-9 ? null : worse };
  }
  async function trendsSection(el, csaName) {
    try {
      const T = await file("trends.json"), c = T.csa[csaName]; if (!c) { el.innerHTML = ""; return; }
      el.innerHTML = `<div class="trends">${TREND_ORDER.filter(k => c[k] && T.series[k]).map(k => { const m = T.series[k], ser = k === "lead" ? nonzero(c[k]) : c[k], ch = change(k, ser, m); if (!ch) return "";
        return `<div class="trend ${ch.worse == null ? "" : ch.worse ? "worse" : "better"}"><div><b>${U.esc(m.label)}</b><small>${ch.y0}: ${ch.a} → ${ch.y1}: ${ch.b}${ch.fit ? " (trend)" : ""}</small><span class="chg">${ch.d}</span></div>${spark(ser)}</div>`; }).join("")}</div>
        <p class="note">Neighborhood (Community Statistical Area) history. Where there are four or more years, the change follows the trend line rather than just the first and last year. Heat from the Baltimore Heat Atlas (satellite surface readings vary with which summer days were captured, so treat the heat trend as approximate); the rest from the Baltimore Neighborhood Indicators Alliance's Vital Signs.</p>`;
    } catch { el.innerHTML = ""; }
  }

  // ---------- water notices and harbor water quality ----------
  function waterBars() {
    const w = LIVE.feeds.city.value?.water || []; if (!w.length) return "";
    const LBL = { boil: "Boil-water advisory", main: "Water main break", outage: "Water service interruption", supply: "Water supply notice" };
    return w.map(n => `<div class="codebar water ${n.kind}">${tile(n.kind === "boil" ? "alert" : "droplet", "#fff")}<div><b>${LBL[n.kind]}: ${U.esc(n.title)}</b><span>${n.kind === "boil" ? "Boil tap water for 1 minute before drinking or cooking, or use bottled water, until the city lifts the advisory. " : ""}Posted ${new Date(n.posted + "T12:00").toLocaleDateString(LOC(), { month: "long", day: "numeric" })}. <a href="${U.esc(n.url)}" target="_blank" rel="noopener">Department of Public Works notice</a></span></div></div>`).join("");
  }
  async function harborSection(el) {
    try {
      const h = await file("harbor.json"); const last = h.sites.map(s => s.date).sort().pop();
      const m = new Date().getMonth() + 1, inSeason = m >= 5 && m <= 9;
      el.innerHTML = `<div class="place">${tile("waves", "var(--link)")}<div><b>Harbor water quality</b><small>${inSeason ? "Latest bacteria results at the harbor's sampling sites." : `Sampling runs ${h.season}. Last results, ${new Date(last + "T12:00").toLocaleDateString(LOC(), { month: "long", day: "numeric" })}:`}</small>
        <ul class="deps">${h.sites.map(s => `<li><span class="rt ${/pass/i.test(s.status) ? "ok" : "bad"}">${/pass/i.test(s.status) ? "Passing" : "Advisory"}</span><span class="hd">${U.esc(s.name)}</span><span class="tm tnum">${s.count ?? "—"}</span></li>`).join("")}</ul>
        <small>Avoid swimming or kayaking for 48 hours after heavy rain. <a href="${U.esc(h.url)}" target="_blank" rel="noopener">Waterfront Partnership</a></small></div></div>`;
    } catch { el.innerHTML = ""; }
  }

  // ---------- neighborhood air sensors (OpenAQ, when a key is configured) ----------
  const pmAqi = c => { const B = [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 500, 301, 500]];
    const b = B.find(([lo, hi]) => c <= hi) || B[B.length - 1]; return Math.round((b[3] - b[2]) / (b[1] - b[0]) * (Math.min(c, 500) - b[0]) + b[2]); };
  const sensors = () => file("sensors.json", { cache: "no-store" }).then(j => (j.sensors || []).map(s => ({ ...s, aqi: pmAqi(s.pm25) }))).catch(() => []);

  // ---------- easy-reading mode ----------
  function easy(on) {
    if (on === undefined) on = U.store.get("easy", false);
    document.documentElement.classList.toggle("easy", !!on); U.store.set("easy", !!on);
    U.$$("[data-easy]").forEach(b => { b.setAttribute("aria-pressed", String(!!on)); });
  }

  // ---------- plain-language meanings ----------
  const WORDS = [
    ["Code Blue", "An extreme-cold alert from the Baltimore City Health Department, usually when the wind chill is expected to drop below 13°F. All emergency shelters open."],
    ["Code Red", "An extreme-heat alert from the Baltimore City Health Department. Cooling centers open."],
    ["Wind chill", "How cold it feels on your skin when wind is added to the temperature."],
    ["Heat index", "How hot it feels when humidity is added to the temperature. Above 103°F is dangerous."],
    ["Air quality (AQI)", "A 0 to 500 score for how clean the air is. Under 50 is good; over 100 is unhealthy for sensitive people, such as those with asthma."],
    ["Flood zone", "An area FEMA's maps show has at least a 1% chance of flooding in any year. Heavy rain can still flood streets and basements outside these zones."],
    ["Warming and cooling centers", "Public buildings, often libraries and senior centers, that open to anyone during very cold or very hot weather."],
    ["SNAP (EBT)", "Federal food benefits, also called food stamps, used with an EBT card at stores that accept them."],
    ["WIC", "A program that gives healthy food to pregnant women, new mothers and children under 5."],
    ["311", "Baltimore's number for city services and non-emergency problems, such as no heat, flooding, trash or potholes."],
    ["211", "A free, 24/7 helpline for food, rent, utility and other help, in any language."],
    ["Neighborhood", "On this site, one of Baltimore's 55 Community Statistical Areas: groups of census tracts used for city statistics."],
  ];
  const glossary = () => WORDS.map(([w, d]) => `<div><dt>${w}</dt><dd>${d}</dd></div>`).join("");

  // ---------- "How it works" ----------
  const GUIDE = [
    ["sun", "#today", "Today", "Is it safe to be outside right now?", "A one-line answer from live weather, air quality and alerts, what matters most right now, and the forecast for the next hours and the week."],
    ["calendar", "#plan", "Plan my day", "When is the best time to go out?", "Pick a walk, run, bike ride, kids playing outside, yard work or a market trip. It finds the best hours in the next two days and can add them to your calendar."],
    ["pin", "#place", "My block", "How does my block compare?", "Type an address to see its summer heat, tree shade, flood risk, lead risk, the closest warm or cool place, food help, the next buses, and how the neighborhood is changing."],
    ["map", "#map", "Map", "Where is the nearest…?", "Turn on what you need: warming and cooling centers, flood zones, air monitors, parks, water fountains, food help, bus stops and more. Tap any spot to check it."],
    ["phone", "#help", "Get help", "Who do I call, and what are my rights?", "Phone numbers with a call button, warm and cool places near you, food help, your rights about heat and utility shut-offs, programs, and water notices."],
    ["bell", "#alerts", "Alerts", "Can it tell me when something's wrong?", "Sign up for BMORE Alert texts from the city, or turn on notifications on this device for warnings, bad air and dangerous heat or cold."],
    ["chart", "#brief", "City brief and Data", "For officials and researchers", "A printable summary of which neighborhoods need help most, plus every number behind the site, free to download."],
  ];
  const guide = () => GUIDE.map(([ic, href, t, q, d]) => `<a class="guide-item" href="${href}">${tile(ic, "var(--accent)")}<div><b>${t}</b><span class="q">${q}</span><p>${d}</p></div>${I("chev", 18)}</a>`).join("");

  return { glossary, guide, nonzero, upcoming, MODE, report, neighborText, neighborCard, foodSection, foodNear, transitSection, stopsNear, leadCard, trendsSection, latest, change, spark, waterBars, harborSection, sensors, easy, file, TREND_ORDER };
})();
