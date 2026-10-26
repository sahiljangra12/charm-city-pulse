# Charm City Pulse

**Live Baltimore environment and sustainability data, from today's air and heat to how every neighborhood compares.**
Sahil, Johns Hopkins University, 2026.

**Live site:** https://sahiljangra12.github.io/charm-city-pulse/

## What it does

**Resident mode**
- **Today:** a live verdict ("Take it easy outside") built from the NWS heat index or wind chill, EPA air monitors, NWS alerts and UV. It also has an animated sky scene, gauges, a 24-hour strip, a 7-day outlook and USGS stream gauges, all of which refresh on their own.
- **My neighborhood:** address autocomplete leads to a report card on heat, trees, health, social vulnerability, housing and energy strain, and getting around and food. Uncertain estimates are flagged, and each report shows the FEMA flood zone at the exact address and the nearest cooling or warming centers for the current season.
- **Map:** layers for scores, cooling and warming centers, FEMA flood zones, live gauges and air monitors, city parks, pools and recreation centers, and OpenStreetMap amenities. Click anywhere for that spot's flood zone and scores.
- **Find help:** a seasonal list of centers, hotlines and programs.

**Researcher mode:** an explorer for 54 indicators across tracts or neighborhoods (CSAs), with margins of error and reliability flags. It also has place comparison with a radar chart, a correlation tool with a redlining overlay, a live-feed and release status page, and CSV and GeoJSON downloads.

**References:** data sources and their vintages are written automatically by each build, alongside the literature and software used.

## How it stays live

| Layer | Updated | How |
|---|---|---|
| Weather, heat index and wind chill, UV, solar | every 5 min | Open-Meteo, in the browser |
| NWS alerts | every 3 min | api.weather.gov |
| Air quality | every 10–15 min | EPA AirNow monitors and the CAMS model |
| Stream gauges | every 15 min | USGS Water Data API v1 |
| Flood zone | on request | FEMA NFHL |
| ACS 5-year, CDC PLACES, city cooling centers, parks, pools and rec centers | daily | `pipeline/refresh.py` in GitHub Actions |
| Heat, land cover, heat vulnerability index | per study release | Baltimore Heat Atlas |

When a new daily build is published, open pages pick it up without reloading. If an upstream source fails, the build keeps the last good copy from `pipeline/cache/`, then falls back to the frozen research inputs in `pipeline/base/`.

## Data fixes compared with v1
- The jail complex tract and a zero-population tract are shown hatched and excluded from rankings.
- Neighborhood (CSA) shares are recomputed from pooled ACS counts with proper margins of error. Neighborhood median income is interpolated from pooled B19001 income brackets.
- The street-tree planting rate is labeled as a neighborhood-level measure.
- Every indicator carries its source vintage. Report cards flag estimates with a coefficient of variation above 30%.
- Cooling centers have clear names. Winter warming centers and shelters (FY 2027 plan, Nov 15, 2026 – Mar 15, 2027) are included and geocoded.
- There is a °F/°C toggle everywhere, and heat and cold categories use the official NWS formulas.

## Run locally
    python3 pipeline/refresh.py            # needs internet; add --offline to rebuild from cache/base
    cd site && python3 -m http.server 8000

## Layout
- `site/`: the static app (no build step)
- `pipeline/refresh.py`: the daily data build (standard library only)
- `pipeline/probe.py`: checks every browser-side API and its CORS header
- `pipeline/base/`: frozen research inputs from the Heat Atlas and Tree Cooling study
- `.github/workflows/refresh-and-deploy.yml`: the daily refresh and the GitHub Pages deploy

To ship it to the app stores, wrap `site/` with Capacitor (iOS and Android); it already works as an installable PWA.
