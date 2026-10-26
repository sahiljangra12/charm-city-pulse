/* References page: data sources (auto from the build), live feeds, literature, software */
const REFS = (() => {
  const LIT = [
    ["U.S. Census Bureau. (2020). <i>Understanding and Using American Community Survey Data: What All Data Users Need to Know.</i> U.S. Government Publishing Office. (Margins of error for derived proportions and aggregated estimates, ch. 8.)", "https://www.census.gov/programs-surveys/acs/library/handbooks/general.html"],
    ["Zhang, X., Holt, J. B., Lu, H., Wheaton, A. G., Ford, E. S., Greenlund, K. J., & Croft, J. B. (2014). Multilevel regression and poststratification for small-area estimation of population health outcomes: A case study of chronic obstructive pulmonary disease prevalence using the Behavioral Risk Factor Surveillance System. <i>American Journal of Epidemiology, 179</i>(8), 1025–1033.", "https://doi.org/10.1093/aje/kwu018"],
    ["Flanagan, B. E., Gregory, E. W., Hallisey, E. J., Heitgerd, J. L., & Lewis, B. (2011). A social vulnerability index for disaster management. <i>Journal of Homeland Security and Emergency Management, 8</i>(1).", "https://doi.org/10.2202/1547-7355.1792"],
    ["Hoffman, J. S., Shandas, V., & Pendleton, N. (2020). The effects of historical housing policies on resident exposure to intra-urban heat: A study of 108 US urban areas. <i>Climate, 8</i>(1), 12.", "https://doi.org/10.3390/cli8010012"],
    ["Nelson, R. K., Winling, L., et al. (2023). <i>Mapping Inequality: Redlining in New Deal America.</i> American Panorama, University of Richmond Digital Scholarship Lab.", "https://dsl.richmond.edu/panorama/redlining/"],
    ["Rothfusz, L. P. (1990). <i>The Heat Index “Equation” (or, More Than You Ever Wanted to Know About Heat Index).</i> NWS Southern Region Technical Attachment SR 90-23. National Weather Service.", "https://www.weather.gov/media/ffc/ta_htindx.PDF"],
    ["National Weather Service. (2001). <i>Wind Chill Temperature Index.</i> NOAA, Office of Climate, Water, and Weather Services.", "https://www.weather.gov/media/epz/wxcalc/windChill.pdf"],
    ["U.S. Environmental Protection Agency. (2024). <i>Technical Assistance Document for the Reporting of Daily Air Quality – the Air Quality Index (AQI)</i> (EPA-454/B-24-002).", "https://www.airnow.gov/publications/air-quality-index/technical-assistance-document-for-reporting-the-daily-aqi/"],
    ["Zanaga, D., Van De Kerchove, R., Daems, D., et al. (2022). <i>ESA WorldCover 10 m 2021 v200.</i> Zenodo.", "https://doi.org/10.5281/zenodo.7254221"],
    ["U.S. Geological Survey. <i>Landsat Collection 2 Level-2 Surface Temperature Science Product.</i>", "https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature"],
    ["Zippenfenig, P. (2023). <i>Open-Meteo.com Weather API</i> [Computer software]. Zenodo.", "https://doi.org/10.5281/zenodo.7970649"],
    ["Sahil. (2026). <i>Where Heat Meets Vulnerability: A validated, uncertainty-aware heat vulnerability index for Baltimore City's census tracts</i> (Working paper). Johns Hopkins University.", "https://github.com/sahiljangra12/baltimore-heat-atlas"],
    ["Sahil. (2026). <i>Do new street trees cool Baltimore? A within-neighborhood event study of street-tree plantings and summer surface temperature, 2006–2025</i> (Working paper). Johns Hopkins University.", "https://github.com/sahiljangra12/baltimore-tree-cooling"],
  ];
  const SOFT = [
    ["Agafonkin, V., et al. <i>Leaflet</i> (v1.9.4) [JavaScript library].", "https://leafletjs.com/"],
    ["Esri. <i>Esri Leaflet</i> (v3.0.12) [JavaScript library].", "https://developers.arcgis.com/esri-leaflet/"],
    ["Chart.js contributors. <i>Chart.js</i> (v4.4.1) [JavaScript library].", "https://www.chartjs.org/"],
    ["OpenStreetMap contributors. <i>OpenStreetMap</i>, data under the Open Database License; basemap tiles © CARTO.", "https://www.openstreetmap.org/copyright"],
    ["GitHub. <i>GitHub Actions and GitHub Pages</i> (daily data build and hosting).", "https://docs.github.com/actions"],
  ];
  const li = (html, url) => `<li>${html} <a href="${url}" target="_blank" rel="noopener">${U.esc(url.replace(/^https?:\/\//, "").slice(0, 70))}</a><button class="copy" data-copy>Copy</button></li>`;
  function show() {
    const m = APP.data.meta, built = new Date(m.built);
    const acc = `Retrieved ${built.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}`;
    U.$("#refData").innerHTML = Object.values(m.sources).map(s => li(`${U.esc(s.by)}. <i>${U.esc(s.name)}</i> (${U.esc(s.vintage)}). <span class="status ${/live/.test(s.status) ? "live" : /cached|frozen/.test(s.status) ? "cached" : ""}">${U.esc(s.status)}</span> ${acc}.`, s.url)).join("");
    U.$("#refLive").innerHTML = LIVE.SOURCES.filter(s => s.id !== "meta").map(s => li(`${U.esc(s.by)}. <i>${U.esc(s.name)}</i>. Live API, ${s.every ? "refreshed every " + s.every + " minutes in your browser" : "queried on request"}.`, s.url)).join("");
    U.$("#refLit").innerHTML = LIT.map(([h, u]) => li(h, u)).join("");
    U.$("#refSoft").innerHTML = SOFT.map(([h, u]) => li(h, u)).join("");
    U.$$("#v-refs [data-copy]").forEach(b => b.onclick = async () => {
      const t = b.parentElement.cloneNode(true); t.querySelector("button").remove();
      try { await navigator.clipboard.writeText(t.textContent.replace(/\s+/g, " ").trim()); b.textContent = "Copied ✓"; setTimeout(() => b.textContent = "Copy", 1600); } catch { U.toast("Copy isn't allowed here; select the text instead."); }
    });
    FX.reveal(U.$("#v-refs"));
  }
  return { views: { refs: { show, reload: show } } };
})();
