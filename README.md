# Charm City Pulse

**Live Baltimore environment and sustainability data, from today's air and heat to how every neighborhood compares.**
Sahil, Johns Hopkins University, 2026.

**Live site:** https://sahiljangra12.github.io/charm-city-pulse/

An independent project. The waving city flag is the public-domain flag of Baltimore from Wikimedia Commons.

## What it does

**Resident mode**
- **Today:** a live verdict ("Take it easy outside") built from the NWS heat index or wind chill, EPA air monitors, NWS alerts and UV. It also has an animated sky scene, gauges, a 24-hour strip, a 7-day outlook and USGS stream gauges, all of which refresh on their own.
- **My neighborhood:** address autocomplete leads to a report card on heat, trees, health, social vulnerability, housing and energy strain, and getting around and food. Uncertain estimates are flagged, and each report shows the FEMA flood zone at the exact address and the nearest cooling or warming centers for the current season.
- **Map:** layers for scores, cooling and warming centers, FEMA flood zones, live gauges and air monitors, city parks, pools and recreation centers, and OpenStreetMap amenities. Click anywhere for that spot's flood zone and scores.
- **Find help:** a seasonal list of centers, hotlines and programs.

**Code Blue and Code Red:** every hour, `pipeline/city_alerts.py` reads the Baltimore City Health Department's announcements. While an alert is in effect, Today leads with it and Help shows a status bar with the shelter hotline. When the forecast reaches Code Blue levels before the city has declared one, the site says it is expected rather than in effect.

**Your rights:** the Help page explains, by season, the city's minimum heat rule for rented homes (Oct 1 – Apr 30), Maryland's winter and heat-wave limits on gas and electric shut-offs, medical delays, and how to apply for energy assistance, each linked to its source.

**Español:** an EN/ES switch in the header translates Today, Plan, My block, Map and Help (`site/js/es.js`). Place names and official National Weather Service wording stay in English; the Data pages stay in English.

**More help for residents:**
- *Food:* nearby city food distribution sites (Department of Planning via BNIA) and groceries that take SNAP (USDA, refreshed monthly), plus the Maryland Food Bank pantry finder, 211 and WIC.
- *Buses and trains:* the next scheduled departures at nearby MTA bus, Light RailLink and Metro stops (MTA GTFS, rebuilt daily), and stops on the map when zoomed in. Live arrivals need an MTA (Swiftly) key and a small server; until then the page links to the Transit app.
- *Water:* Department of Public Works boil-water advisories, main breaks and supply notices (checked hourly), and the Waterfront Partnership's harbor bacteria results.
- *Lead:* in neighborhoods with many pre-1940 homes, My block explains the lead-paint risk with BNIA's children's blood-lead data and the Health Department's free testing line.
- *311 shortcuts:* "no heat", "street flooding" and "water in basement" buttons that name the exact 311 request to choose.
- *Check on a neighbor:* on Code Blue and Code Red days, a ready-to-send text with the hotline numbers.
- *Neighborhood change:* heat (Heat Atlas 2019–2025), tree canopy, poverty, vacancy, life expectancy and children's lead over time, on My block and in the City brief.
- *Air sensors:* low-cost neighborhood sensors from OpenAQ appear on the map once a free key is saved as the `OPENAQ_API_KEY` repository secret.
- *Easy reading:* larger text and stronger contrast, from the menu or the footer.

**City brief** (`#brief`): a one-page summary for city and state staff. It ranks all 55 neighborhoods by combined heat, missing shade, health sensitivity and social vulnerability (or any one of them), shows how far each is from the nearest warming or cooling center open this season, and headlines the key citywide figures. It prints cleanly or saves as a PDF, has its own link, and the table downloads as CSV. Every neighborhood report under My block can also be printed or shared by link.

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

Background photos come from Wikimedia Commons. `pipeline/images.py` takes each original at up to 4K (3840 px), lightly enhances it (contrast, colour, sharpening) and saves 4K, 2000 px and phone sizes; browsers pick the size that fits the screen.

A slow server can't stall the build: the network phase has a 13-minute budget, and once a host times out every later request to it is skipped for that run and served from cache. If the daily build ever falls more than 36 hours behind, the site says so in the footer, on the Data pages and in Live feeds.

For the Census Bureau API, add a free key (https://api.census.gov/data/key_signup.html) as the repository secret `CENSUS_API_KEY`. Without it the build uses Census Reporter, which serves the same ACS release.

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
