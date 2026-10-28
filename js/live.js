/* Live public data feeds — fetched by the browser, auto-refreshing, no keys */
const LIVE = (() => {
  const CENTER = [39.2904, -76.6122];
  const BBOX = { w: -76.712, s: 39.197, e: -76.529, n: 39.372 };
  const TZ = "America/New_York";

  const SOURCES = [
    { id: "weather", name: "Weather, forecast, UV and solar radiation", by: "Open-Meteo (NOAA GFS/HRRR and other models)", url: "https://open-meteo.com/en/docs", every: 5 },
    { id: "air", name: "Modeled air quality (US AQI, PM2.5, ozone, NO₂)", by: "Open-Meteo Air Quality (Copernicus CAMS)", url: "https://open-meteo.com/en/docs/air-quality-api", every: 10 },
    { id: "airnow", name: "Official air monitors near Baltimore (hourly)", by: "U.S. EPA AirNow monitoring-site feed", url: "https://www.airnow.gov/", every: 15 },
    { id: "alerts", name: "Active watches, warnings and advisories", by: "National Weather Service API", url: "https://www.weather.gov/documentation/services-web-api", every: 3 },
    { id: "water", name: "Stream flow, water level and water temperature", by: "USGS Water Data APIs (v1)", url: "https://api.waterdata.usgs.gov/", every: 15 },
    { id: "flood", name: "Flood hazard zone at a point", by: "FEMA National Flood Hazard Layer", url: "https://hazards.fema.gov/femaportal/resources/flood_map_svc.htm", every: 0 },
    { id: "geo", name: "Address search and autocomplete", by: "Esri World Geocoder, with Photon and Nominatim (OpenStreetMap) as fallbacks", url: "https://developers.arcgis.com/rest/geocode/", every: 0 },
    { id: "osm", name: "Fountains, transit, bike lanes, EV chargers, gardens, recycling, markets", by: "OpenStreetMap contributors via the Overpass API", url: "https://wiki.openstreetmap.org/wiki/Overpass_API", every: 0 },
    { id: "meta", name: "Neighborhood data releases (Census ACS, CDC PLACES, city layers)", by: "Charm City Pulse daily build (GitHub Actions)", url: "https://github.com/sahiljangra12/charm-city-pulse/actions", every: 15 },
  ];
  const status = {};
  const mark = (id, ok, err) => { status[id] = { ok, at: new Date(), err: err ? String(err.message || err) : null }; document.dispatchEvent(new CustomEvent("live-status", { detail: id })); };
  async function track(id, p) { try { const v = await p; mark(id, true); return v; } catch (e) { mark(id, false, e); throw e; } }

  // ---------- auto-refreshing feeds ----------
  const feeds = {};
  function feed(id, loader) {
    const def = SOURCES.find(s => s.id === id); const every = (def?.every || 10) * 60000;
    const f = feeds[id] = { id, every, value: null, at: null, err: null, subs: new Set(), next: null, busy: false, promise: null };
    f.refresh = async () => {
      if (f.busy) return f.promise;
      f.busy = true; document.dispatchEvent(new CustomEvent("feed-busy", { detail: id }));
      f.promise = track(id, loader()).then(v => { f.value = v; f.at = new Date(); f.err = null; return v; })
        .catch(e => { f.err = e; if (f.value == null) throw e; return f.value; })
        .finally(() => { f.busy = false; f.next = Date.now() + f.every; f.subs.forEach(fn => { try { fn(f.value, f); } catch (e) { console.error(e); } }); });
      return f.promise;
    };
    f.get = () => f.value != null ? Promise.resolve(f.value) : (f.promise || f.refresh());
    f.on = fn => { f.subs.add(fn); if (f.value != null) fn(f.value, f); else f.get().catch(() => fn(null, f)); return () => f.subs.delete(fn); };
    return f;
  }
  setInterval(() => {
    if (document.hidden) return;
    Object.values(feeds).forEach(f => { if (f.subs.size && f.next && Date.now() >= f.next) f.refresh().catch(() => {}); });
  }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) Object.values(feeds).forEach(f => { if (f.subs.size && f.at && Date.now() - f.at > f.every) f.refresh().catch(() => {}); });
  });

  // ---------- weather / air / alerts ----------
  feed("weather", () => U.getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${CENTER[0]}&longitude=${CENTER[1]}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,weather_code,is_day,cloud_cover` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation_probability,uv_index,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset,shortwave_radiation_sum,wind_speed_10m_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=${encodeURIComponent(TZ)}&forecast_days=7`));
  feed("air", () => U.getJSON(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CENTER[0]}&longitude=${CENTER[1]}` +
    `&current=us_aqi,us_aqi_pm2_5,us_aqi_ozone,us_aqi_nitrogen_dioxide,pm2_5,pm10,ozone,nitrogen_dioxide&hourly=us_aqi&timezone=${encodeURIComponent(TZ)}&forecast_days=2`));
  feed("alerts", () => U.getJSON(`https://api.weather.gov/alerts/active?point=${CENTER[0]},${CENTER[1]}`, { headers: { Accept: "application/geo+json" } })
    .then(j => (j.features || []).map(f => f.properties).filter(p => p.status !== "Test")));

  // ---------- AirNow monitors ----------
  const AIRNOW = "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Air_Now_Monitor_Data_Public/FeatureServer/0";
    feed("airnow", async () => {
    const j = await U.getJSON(`${AIRNOW}/query?where=1%3D1&geometry=-76.95,39.05,-76.30,39.60&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&outFields=*&f=json`, {}, 20000);
    if (j.error) throw new Error(j.error.message);
    const sites = {};
    (j.features || []).forEach(f => {
      const a = f.attributes; if (!a || (a.Status && a.Status !== "Active")) return;
      const lat = a.Latitude ?? f.geometry?.y, lon = a.Longitude ?? f.geometry?.x; if (lat == null) return;
      const name = a.SiteName || "Monitor";
      const s = sites[name] || (sites[name] = { name, lat, lon, readings: {} });
      [["PM2.5", "PM25"], ["Ozone", "OZONE"], ["PM10", "PM10"]].forEach(([lab, k]) => {
        const v = a[k + "_AQI"]; if (v != null && v >= 0) s.readings[lab] = { aqi: v, value: a[k], unit: a[k + "_Unit"] };
      });
      if (a.ValidTime) s.time = new Date(a.ValidTime);
    });
    const out = Object.values(sites).filter(s => Object.keys(s.readings).length);
    out.forEach(s => { s.aqi = Math.max(...Object.values(s.readings).map(r => r.aqi)); s.km = U.km([CENTER[1], CENTER[0]], [s.lon, s.lat]); });
    return out.sort((a, b) => a.km - b.km);
  });

  // ---------- USGS water (v1 then v0) ----------
  const PCODES = { "00060": { name: "Flow", unit: "ft³/s" }, "00065": { name: "Water level", unit: "ft" }, "00010": { name: "Water temp", unit: "°C" } };
  async function waterFetch(ver) {
    const base = `https://api.waterdata.usgs.gov/ogcapi/${ver}/collections`;
    const bb = `${BBOX.w - .05},${BBOX.s - .03},${BBOX.e + .03},${BBOX.n + .05}`;
    const [vals, locs] = await Promise.all([
      U.getJSON(`${base}/latest-continuous/items?f=json&bbox=${bb}&parameter_code=00060,00065,00010&limit=500`, {}, 25000),
      U.getJSON(`${base}/monitoring-locations/items?f=json&bbox=${bb}&limit=500`, {}, 25000).catch(() => ({ features: [] })),
    ]);
    const names = {};
    (locs.features || []).forEach(f => { const id = f.id || f.properties.id || f.properties.monitoring_location_id; names[id] = f.properties.monitoring_location_name; });
    const sites = {};
    (vals.features || []).forEach(f => {
      const p = f.properties, id = p.monitoring_location_id;
      if (!PCODES[p.parameter_code] || p.value == null) return;
      if ((Date.now() - new Date(p.time)) / 864e5 > 7) return;
      const s = sites[id] || (sites[id] = { id, name: names[id] || id, coords: f.geometry ? f.geometry.coordinates : null, readings: {} });
      if (!s.coords && f.geometry) s.coords = f.geometry.coordinates;
      const prev = s.readings[p.parameter_code];
      if (!prev || new Date(p.time) > new Date(prev.time)) s.readings[p.parameter_code] = { value: +p.value, unit: PCODES[p.parameter_code].unit, time: p.time };
    });
    return Object.values(sites).filter(s => s.coords).sort((a, b) => a.name.localeCompare(b.name));
  }
  feed("water", () => waterFetch("v1").catch(() => waterFetch("v0")));

  // ---------- data-release watcher (site/data/meta.json) ----------
  feed("meta", () => U.getJSON("data/meta.json?t=" + Date.now(), { cache: "no-store" }));

  // ---------- FEMA flood ----------
  const NFHL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer";
  let floodLayer = 28;
  const ZONE_TEXT = {
    A: "High-risk flood zone (1% annual chance; no base flood elevation set)", AE: "High-risk flood zone (1% annual chance flood)", AO: "High-risk shallow-flooding zone (sheet flow)",
    AH: "High-risk ponding zone", VE: "High-risk coastal zone with wave action", X: "Outside the 1% annual-chance flood zone", D: "Flood risk undetermined",
  };
  async function floodAt(lat, lon) {
    const q = id => U.getJSON(`${NFHL}/${id}/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE&returnGeometry=false&f=json`, {}, 20000);
    let j = await track("flood", q(floodLayer));
    if (j.error) { // layer id moved? look it up once
      const L = await U.getJSON(`${NFHL}/layers?f=json`); const hit = (L.layers || []).find(l => /^Flood Hazard Zones$/i.test(l.name));
      if (!hit) throw new Error(j.error.message || "FEMA query failed"); floodLayer = hit.id; j = await track("flood", q(floodLayer));
    }
    const f = (j.features || [])[0];
    if (!f) return { zone: "X", sfha: false, text: ZONE_TEXT.X, level: 0 };
    const a = f.attributes; const zone = a.FLD_ZONE; let text = ZONE_TEXT[zone] || ("Zone " + zone), level = a.SFHA_TF === "T" ? 2 : 0;
    if (zone === "X" && /0\.2/.test(a.ZONE_SUBTY || "")) { text = "Moderate risk (0.2% annual chance, the '500-year' floodplain)"; level = 1; }
    if (/FLOODWAY/i.test(a.ZONE_SUBTY || "")) { text += ", inside the regulatory floodway"; level = 3; }
    return { zone, sub: a.ZONE_SUBTY, sfha: a.SFHA_TF === "T", bfe: a.STATIC_BFE > -9000 ? a.STATIC_BFE : null, text, level };
  }

  // ---------- geocoding with autocomplete ----------
  const ESRI = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
  const EXT = `${BBOX.w - .02},${BBOX.s - .02},${BBOX.e + .02},${BBOX.n + .02}`;
  const inBox = (lat, lon) => lat > BBOX.s - .03 && lat < BBOX.n + .03 && lon > BBOX.w - .03 && lon < BBOX.e + .03;
  async function suggest(text) {
    if (text.trim().length < 3) return [];
    try {
      const j = await U.getJSON(`${ESRI}/suggest?f=json&maxSuggestions=6&countryCode=USA&searchExtent=${EXT}&location=${CENTER[1]},${CENTER[0]}&text=${encodeURIComponent(text)}`, {}, 6000);
      if (j.error) throw new Error(j.error.message);
      const s = (j.suggestions || []).filter(x => !x.isCollection).map(x => ({ text: x.text, magicKey: x.magicKey, provider: "esri" }));
      if (s.length) { mark("geo", true); return s; }
    } catch (e) { /* fall through */ }
    try {
      const j = await U.getJSON(`https://photon.komoot.io/api/?limit=6&lat=${CENTER[0]}&lon=${CENTER[1]}&bbox=${EXT}&q=${encodeURIComponent(text)}`, {}, 6000);
      mark("geo", true);
      return (j.features || []).map(f => { const p = f.properties, [lon, lat] = f.geometry.coordinates;
        return { text: [p.housenumber && p.street ? p.housenumber + " " + p.street : p.name || p.street, p.district || p.city, p.postcode].filter(Boolean).join(", "), lat, lon, provider: "photon" }; })
        .filter(s => inBox(s.lat, s.lon));
    } catch (e) { mark("geo", false, e); return []; }
  }
  async function geocode(q) {   // q: string or a suggestion
    if (q && q.lat != null) return { lat: q.lat, lon: q.lon, label: q.text };
    const text = typeof q === "string" ? q : q.text, mk = q && q.magicKey;
    const single = /baltimore/i.test(text) ? text : text + ", Baltimore, MD";
    try {
      const j = await U.getJSON(`${ESRI}/findAddressCandidates?f=json&maxLocations=1&outFields=Match_addr,Score&searchExtent=${EXT}&SingleLine=${encodeURIComponent(mk ? text : single)}${mk ? "&magicKey=" + encodeURIComponent(mk) : ""}`, {}, 8000);
      const c = (j.candidates || [])[0];
      if (c && c.score >= 75 && inBox(c.location.y, c.location.x)) { mark("geo", true); return { lat: c.location.y, lon: c.location.x, label: c.attributes?.Match_addr || c.address }; }
    } catch (e) { /* next */ }
    try {
      const s = await suggest(single); const p = s.find(x => x.lat != null);
      if (p) return { lat: p.lat, lon: p.lon, label: p.text };
    } catch (e) { /* next */ }
    const r = await track("geo", U.getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&bounded=1&viewbox=${BBOX.w - .02},${BBOX.n + .02},${BBOX.e + .02},${BBOX.s - .02}&q=${encodeURIComponent(single)}`));
    return r.length ? { lat: +r[0].lat, lon: +r[0].lon, label: r[0].display_name.split(",").slice(0, 3).join(",") } : null;
  }

  // ---------- OpenStreetMap layers ----------
  const bb = `(${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e})`;
  const OSM = {
    fountains: { label: "Drinking fountains", q: `node["amenity"="drinking_water"]${bb};out;`, color: "#2f7fb5" },
    transit: { label: "Rail & light-rail stations", q: `node["railway"~"^(station|halt|tram_stop)$"]${bb};node["public_transport"="station"]${bb};out;`, color: "#6b4c9a" },
    bike: { label: "Bike lanes & trails", q: `way["highway"="cycleway"]${bb};way["cycleway"~"lane|track"]${bb};way["cycleway:right"~"lane|track"]${bb};way["cycleway:left"~"lane|track"]${bb};way["cycleway:both"~"lane|track"]${bb};out geom;`, color: "#d0672b" },
    ev: { label: "EV charging", q: `nwr["amenity"="charging_station"]${bb};out center;`, color: "#c99a12" },
    gardens: { label: "Community gardens", q: `nwr["garden:type"="community"]${bb};nwr["landuse"="allotments"]${bb};out center;`, color: "#7aa83a" },
    recycling: { label: "Recycling drop-offs", q: `nwr["amenity"="recycling"]["recycling_type"!="container"]${bb};out center;`, color: "#4a7f8c" },
    markets: { label: "Farmers & public markets", q: `nwr["amenity"="marketplace"]${bb};out center;`, color: "#b4472f" },
    parks_osm: { label: "Parks (OpenStreetMap)", q: `way["leisure"="park"]${bb};out geom;relation["leisure"="park"]${bb};out geom;`, color: "#2e7a58" },
  };
  const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
  const osmCache = {};
  async function osm(key) {
    if (osmCache[key]) return osmCache[key];
    let err;
    for (const url of OVERPASS) {
      try {
        const j = await track("osm", U.getJSON(url, { method: "POST", body: "data=" + encodeURIComponent(`[out:json][timeout:25];(${OSM[key].q});`), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 30000));
        return (osmCache[key] = j.elements || []);
      } catch (e) { err = e; }
    }
    throw err;
  }

  // ---------- categories ----------
  function aqiCat(a) {
    if (a == null) return { t: "No data", c: "#999", lvl: 0 };
    if (a <= 50) return { t: "Good", c: "#1e9e5a", lvl: 0, tip: "Air is clean. A great time to be outside." };
    if (a <= 100) return { t: "Moderate", c: "#e3a900", lvl: 1, tip: "Unusually sensitive people should consider shorter, lighter outdoor activity." };
    if (a <= 150) return { t: "Unhealthy for sensitive groups", c: "#ef7d16", lvl: 2, tip: "People with asthma or heart or lung disease, children, older adults and outdoor workers should limit long or heavy exertion outside." };
    if (a <= 200) return { t: "Unhealthy", c: "#d6283b", lvl: 3, tip: "Everyone should cut back on long or heavy exertion outdoors." };
    if (a <= 300) return { t: "Very unhealthy", c: "#8f1d4a", lvl: 4, tip: "Avoid long or heavy exertion outdoors; sensitive groups should stay inside." };
    return { t: "Hazardous", c: "#5a0d2e", lvl: 5, tip: "Everyone should avoid outdoor activity." };
  }
  // NWS heat-index categories; cold uses NWS wind chill and Baltimore Code Blue (13°F)
  function feelsCat(T, RH, V) {
    if (T == null) return null;
    if (T >= 80) {
      const hi = U.heatIndex(T, RH);
      const c = hi >= 125 ? { t: "Extreme danger", c: "#8f1d4a", lvl: 4 } : hi >= 103 ? { t: "Danger", c: "#d6283b", lvl: 3 } : hi >= 90 ? { t: "Extreme caution", c: "#ef7d16", lvl: 2 } : hi >= 80 ? { t: "Caution", c: "#e3a900", lvl: 1 } : { t: "Comfortable", c: "#1e9e5a", lvl: 0 };
      return { ...c, kind: "heat", index: hi, label: "Heat index" };
    }
    if (T <= 50) {
      const wc = U.windChill(T, V);
      const c = wc <= 13 ? { t: "Code Blue cold (wind chill 13°F or below)", c: "#1d4f7c", lvl: 3 } : wc <= 32 ? { t: "Freezing. Winter shelters open", c: "#3d7fb2", lvl: 2 } : wc <= 40 ? { t: "Cold", c: "#79aed1", lvl: 1 } : { t: "Cool", c: "#1e9e5a", lvl: 0 };
      return { ...c, kind: "cold", index: wc, label: "Wind chill" };
    }
    return { t: "Comfortable", c: "#1e9e5a", lvl: 0, kind: "mild", index: T, label: "Feels like" };
  }
  function uvCat(u) {
    if (u == null) return { t: "—", c: "#999" };
    if (u < 3) return { t: "Low", c: "#1e9e5a", tip: "No protection needed for most people." };
    if (u < 6) return { t: "Moderate", c: "#e3a900", tip: "Sunscreen and shade around midday." };
    if (u < 8) return { t: "High", c: "#ef7d16", tip: "Sunscreen, a hat and shade from 10 am to 4 pm." };
    if (u < 11) return { t: "Very high", c: "#d6283b", tip: "Minimize sun between 10 am and 4 pm." };
    return { t: "Extreme", c: "#8f1d4a", tip: "Avoid the midday sun." };
  }
  function season(d = new Date()) {
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 1115 || md <= 315) return "winter";
    if (md >= 515 && md <= 915) return "summer";
    return "shoulder";
  }
  const WMO = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Heavy showers", 85: "Snow showers", 86: "Snow showers", 95: "Thunderstorms", 96: "Thunderstorms with hail", 99: "Thunderstorms with hail" };
  const sky = c => c === 0 || c === 1 ? "clear" : c <= 3 ? "cloudy" : c <= 48 ? "fog" : c <= 67 || (c >= 80 && c <= 82) ? "rain" : c <= 77 || c === 85 || c === 86 ? "snow" : "storm";

  return { CENTER, BBOX, SOURCES, status, feeds, PCODES, OSM, osm, NFHL, floodLayer: () => floodLayer, floodAt, suggest, geocode, aqiCat, feelsCat, uvCat, season, WMO, sky };
})();
