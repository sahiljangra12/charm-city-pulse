/* Data health: one page that says, in plain words, whether every piece of data on the site is fresh.
   Reads the timestamps each pipeline writes into its data file, plus the build record (health.json). */
const HEALTH = (() => {
  const REPO = "https://github.com/sahiljangra12/charm-city-pulse/actions";
  const get = f => fetch("data/" + f + "?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  // [name, file, how to read its time, expected refresh in hours, what it powers]
  const FILES = [
    ["Neighborhood data (Census, CDC, heat, city layers)", "meta.json", j => j.built, 30, "Every neighborhood number, the map colors and My block"],
    ["Code Blue / Code Red and water notices (checked hourly)", "sensors.json", j => j.updated, 3, "The alert bar on Today and Get help"],
    ["Food help (pantries, SNAP stores)", "food.json", j => j.updated, 30, "Food help on Get help, My block and the map"],
    ["Bus, light rail and Metro schedules", "transit/index.json", j => j.built, 30, "Next departures at stops"],
    ["Neighborhood trends", "trends.json", j => j.updated, 30, "Trend charts on My block and the City brief"],
    ["Harbor water quality", "harbor.json", j => j.updated, 30, "Harbor water on Get help (sampled May to September)"],
    ["City services (trash day, snow routes, Wi-Fi, libraries)", "services.json", j => j.updated, 30, "My block and the map"],
  ];
  const STEP = { refresh: "Neighborhood data", extras: "Food, trends, schedules", alerts: "Code Blue/Red and water", photos: "Photos", city: "City services" };
  const badge = (ok, txt) => `<span class="status ${ok === true ? "live" : ok === false ? "err" : "cached"}">● ${txt}</span>`;
  async function show() {
    const el = U.$("#healthBody"); el.innerHTML = `<div class="skeleton" style="height:120px"></div>`;
    const [hl, ...files] = await Promise.all([get("health.json"), ...FILES.map(f => get(f[1]))]);
    let bad = 0;
    const rows = FILES.map(([name, , at, every, what], i) => {
      const j = files[i]; const t = j && at(j);
      if (!t) return `<tr><td>${name}</td><td>${badge(null, "Not available yet")}</td><td>—</td><td class="muted">${what}</td></tr>`;
      const h = (Date.now() - new Date(t)) / 36e5, ok = h <= every; if (!ok) bad++;
      return `<tr><td>${name}</td><td>${badge(ok, ok ? "Up to date" : "Behind schedule")}</td><td>${U.timeAgo(t)}</td><td class="muted">${what}</td></tr>`;
    }).join("");
    const live = LIVE.SOURCES.filter(s => s.id !== "meta").map(s => { const st = LIVE.status[s.id];
      return `<tr><td>${U.esc(s.name)}</td><td>${st ? badge(st.ok, st.ok ? "Working" : "Not answering, retrying") : badge(null, "Loads when needed")}</td><td>${st ? U.timeAgo(st.at) : "—"}</td><td class="muted">${U.esc(s.by)}</td></tr>`; }).join("");
    const steps = hl ? Object.entries(hl.steps || {}).filter(([, v]) => v && v !== "skipped") : [];
    const failed = steps.filter(([, v]) => v === "failure"); bad += failed.length;
    el.innerHTML = `<div class="card health-sum ${bad ? "warn" : "ok"}"><h2>${bad ? "Some data is behind" : "Everything is up to date"}</h2>
        <p>${bad ? "The site keeps showing the last good copy of anything that is behind, with its date. Live weather, air quality and alerts are not affected." : "Every data source refreshed on schedule."}
        ${hl ? ` Last daily build ${U.timeAgo(hl.built)}.` : ""}</p>
        ${steps.length ? `<p class="steps">${steps.map(([k, v]) => `${badge(v === "success", (STEP[k] || k))}`).join(" ")}</p>` : ""}</div>
      <div class="section-h"><h2>Data the site rebuilds</h2></div>
      <div class="tablewrap"><table><thead><tr><th>Data</th><th>Status</th><th>Updated</th><th>Used for</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="section-h"><h2>Live feeds (read directly while you use the site)</h2></div>
      <div class="tablewrap"><table><thead><tr><th>Feed</th><th>Status</th><th>Last answer</th><th>From</th></tr></thead><tbody>${live}</tbody></table></div>
      <p class="note">How this is watched: a check runs every 6 hours and emails the maintainer if anything falls behind, and every page is tested automatically before each update goes live. <a href="${hl?.run || REPO}" target="_blank" rel="noopener">See the build log</a>.</p>`;
  }
  return { views: { status: { init: () => document.addEventListener("live-status", () => APP.view === "status" && show()), show, reload: show } } };
})();
