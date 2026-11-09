"""Daily extras for Charm City Pulse: food help, harbor water quality, neighborhood trends and bus schedules.

Each part is independent: if a source fails, its previous file in site/data/ is kept and the others still run.
Standard library only. Run after refresh.py:  python pipeline/extras.py

  food.json            City food distribution sites (Baltimore Neighborhood Indicators Alliance / Dept. of Planning)
                       and stores that take SNAP (USDA Food and Nutrition Service retailer data, refreshed monthly)
  harbor.json          Waterfront Partnership's Healthy Harbor bacteria sampling (5 sites, May to September)
  trends.json          Per-neighborhood history: summer surface heat 2019-2025 (Baltimore Heat Atlas), tree canopy,
                       trees planted, household poverty, vacant homes, life expectancy, children's blood lead (BNIA Vital Signs)
  transit/<tile>.json  Scheduled departures today and tomorrow at every MTA bus, Light RailLink and Metro stop (MTA GTFS)
"""
import csv, io, json, math, os, re, sys, time, urllib.parse, urllib.request, zipfile
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BASE, CACHE = os.path.join(HERE, "base"), os.path.join(HERE, "cache")
OUT = os.path.join(os.path.dirname(HERE), "site", "data")
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}
NOW = datetime.now(timezone.utc)
from zoneinfo import ZoneInfo
TODAY = NOW.astimezone(ZoneInfo("America/New_York")).date()   # service days are Baltimore local dates
BBOX = (-76.712, 39.197, -76.529, 39.372)   # w, s, e, n
DEADLINE = time.time() + 600


def log(*a): print("[extras]", *a, flush=True)


def get(url, timeout=90, data=None):
    left = DEADLINE - time.time()
    if left < 10: raise RuntimeError("time budget used")
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=UA), timeout=min(timeout, left)) as r:
        return r.read()


def jget(url, **kw): return json.loads(get(url, **kw))
def save(name, obj, indent=None):
    p = os.path.join(OUT, name); os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(obj, open(p, "w"), separators=(",", ":") if indent is None else None, indent=indent)
def in_box(lat, lon): return BBOX[1] < lat < BBOX[3] and BBOX[0] < lon < BBOX[2]


# ---------------------------------------------------------------- city boundary test (tract polygons)
GEO = json.load(open(os.path.join(BASE, "tracts_geo.json")))
def _rings(g): return [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
def _inside(x, y, ring):
    c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi: c = not c
        j = i
    return c
TRACT_RINGS = [(f["properties"]["id"], f["properties"]["csa"], _rings(f["geometry"])) for f in GEO["features"]]
def tract_of(lat, lon):
    if not in_box(lat, lon): return None
    for tid, csa, rings in TRACT_RINGS:
        if any(_inside(lon, lat, r) for r in rings): return tid, csa
    return None


BNIA = "https://services1.arcgis.com/mVFRs7NF4iFitgbY/arcgis/rest/services/{}/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry={}&outSR=4326&f=json"


# ---------------------------------------------------------------- food help
SNAP_ZIP = "https://www.fna.usda.gov/sites/default/files/resource-files/snap-retailer-locator-data2005-2025.zip"
GROCERY = re.compile(r"super|grocery|farmers|market|combination|specialty|meat|fruit|bakery|seafood", re.I)


def snap_stores():
    cp = os.path.join(CACHE, "snap_baltimore.json")
    if os.path.exists(cp) and time.time() - os.path.getmtime(cp) < 25 * 86400:
        return json.load(open(cp))
    z = zipfile.ZipFile(io.BytesIO(get(SNAP_ZIP, timeout=240)))
    name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
    rows = csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig", errors="replace"))
    cols = {c.lower().replace("_", " ").strip(): c for c in rows.fieldnames}
    col = lambda *keys: next((cols[k] for k in cols if all(s in k for s in keys)), None)
    c_name, c_type, c_lat, c_lon = col("store", "name"), col("store", "type"), col("latitude"), col("longitude")
    c_end, c_state = col("end", "date"), col("state")
    c_num, c_street, c_city, c_zip = col("street", "number"), col("street", "name"), col("city"), col("zip", "code")
    log("SNAP columns:", c_name, c_type, c_lat, c_lon, c_end, c_state)
    out = []
    for r in rows:
        if c_state and (r.get(c_state) or "").strip().upper() != "MD": continue
        if c_end and (r.get(c_end) or "").strip(): continue                     # no end date = still authorized
        try: lat, lon = float(r[c_lat]), float(r[c_lon])
        except (TypeError, ValueError, KeyError): continue
        if not tract_of(lat, lon): continue
        addr = " ".join(x for x in [(r.get(c_num) or "").strip(), (r.get(c_street) or "").strip().title()] if x)
        out.append({"name": (r.get(c_name) or "").strip().title(), "type": (r.get(c_type) or "").strip(), "address": addr,
                    "lat": round(lat, 5), "lon": round(lon, 5), "grocery": bool(GROCERY.search(r.get(c_type) or ""))})
    if len(out) < 100: raise RuntimeError(f"only {len(out)} SNAP stores found")
    json.dump(out, open(cp, "w"), separators=(",", ":"))
    return out


def food():
    res = {"updated": NOW.isoformat(timespec="minutes")}
    try:
        j = jget(BNIA.format("DOP_Pounds_of_Food_2026", "true"))
        res["sites"] = [{"name": a["Site_Name"].strip(), "address": (a.get("Address") or "").strip(), "lat": round(f["geometry"]["y"], 5), "lon": round(f["geometry"]["x"], 5)}
                        for f in j.get("features", []) for a in [f["attributes"]] if f.get("geometry") and a.get("Site_Name")]
        res["sites_source"] = "Baltimore City Department of Planning food distribution sites, via BNIA (2026 update)"
        log("food distribution sites", len(res["sites"]))
    except Exception as e:
        log("food sites failed:", e)
    try:
        res["snap"] = snap_stores(); res["snap_source"] = "USDA Food and Nutrition Service SNAP retailer data (current to Dec 31, 2025)"
        log("SNAP stores", len(res["snap"]), "groceries", sum(s["grocery"] for s in res["snap"]))
    except Exception as e:
        log("SNAP failed:", str(e)[:200])
    old = os.path.join(OUT, "food.json")
    if os.path.exists(old):
        prev = json.load(open(old))
        for k in ("sites", "sites_source", "snap", "snap_source"): res.setdefault(k, prev.get(k))
    if res.get("sites") or res.get("snap"): save("food.json", res)


# ---------------------------------------------------------------- harbor water quality
HARBOR = "https://services2.arcgis.com/orhH6cbKzLjUCxfK/arcgis/rest/services/Baltimore_Harbor_2024_Water_Quality_Data_with_2023_Historic_Data/FeatureServer/0/query?where=1%3D1&outFields=Site_Name,New_Sample_Date,New_Sample_Status,New_Sample_BacteriaCount,Rain_amount_past7days&outSR=4326&f=json"
def harbor():
    j = jget(HARBOR)
    sites = []
    for f in j.get("features", []):
        a, g = f["attributes"], f.get("geometry") or {}
        if not a.get("Site_Name") or g.get("y") is None: continue
        d = a.get("New_Sample_Date")
        sites.append({"name": a["Site_Name"].strip(), "date": datetime.fromtimestamp(d / 1000, timezone.utc).date().isoformat() if d else None,
                      "status": (a.get("New_Sample_Status") or "").strip(), "count": a.get("New_Sample_BacteriaCount"), "lat": round(g["y"], 5), "lon": round(g["x"], 5)})
    if not sites: raise RuntimeError("no harbor sites")
    save("harbor.json", {"updated": NOW.isoformat(timespec="minutes"), "source": "Waterfront Partnership of Baltimore, Healthy Harbor water quality monitoring",
                         "url": "https://www.waterfrontpartnership.org/water-quality-monitoring", "season": "May to September", "sites": sites}, indent=1)
    log("harbor sites", len(sites), "latest", max(s["date"] or "" for s in sites))


# ---------------------------------------------------------------- trends by neighborhood
SERIES = {   # key: (BNIA service, field prefix, label, unit, direction: +1 means higher is worse)
    "tree_canopy": ("Trees", "trees", "Tree canopy", "%", -1),
    "trees_planted": ("Treeplnt", "treeplnt", "Street trees planted", "trees", -1),
    "poverty": ("Hhpov", "hhpov", "Households in poverty", "%", 1),
    "vacant": ("Vacant", "vacant", "Vacant and abandoned homes", "%", 1),
    "life_exp": ("Lifexp", "lifexp", "Life expectancy", "years", -1),
    "lead": ("Ebll", "ebll", "Children tested with elevated blood lead", "%", 1),
}
def trends():
    out = {"updated": NOW.isoformat(timespec="minutes"), "series": {}, "csa": {}}
    # heat from the Baltimore Heat Atlas: population-weighted per neighborhood, each summer
    atlas = list(csv.DictReader(open(os.path.join(BASE, "atlas_tracts.csv"))))
    csa_of = {f["properties"]["id"]: f["properties"]["csa"] for f in GEO["features"]}
    years = sorted(int(c[4:]) for c in atlas[0] if re.fullmatch(r"lst_20\d\d", c))
    acc = {}
    for r in atlas:
        csa, w = csa_of.get(r["GEOID"]), float(r.get("pop2020") or 0)
        if not csa or w <= 0: continue
        for y in years:
            try: v = float(r[f"lst_{y}"])
            except (TypeError, ValueError): continue
            s = acc.setdefault(csa, {}).setdefault(y, [0.0, 0.0]); s[0] += v * w; s[1] += w
    for csa, ys in acc.items():
        out["csa"].setdefault(csa, {})["heat"] = {str(y): round(s[0] / s[1], 2) for y, s in sorted(ys.items()) if s[1]}
    out["series"]["heat"] = {"label": "Summer surface temperature where people live", "unit": "°C", "direction": 1, "source": "Baltimore Heat Atlas (Landsat 8/9)"}
    for key, (svc, pre, label, unit, d) in SERIES.items():
        try:
            j = jget(BNIA.format(svc, "false"))
            for f in j.get("features", []):
                a = f["attributes"]; csa = a.get("CSA2010") or a.get("CSA2020")
                vals = {}
                for k, v in a.items():
                    m = re.fullmatch(pre + r"(\d\d)", k)
                    if m and v is not None: vals[str(2000 + int(m.group(1)))] = round(float(v), 2)
                if csa and vals: out["csa"].setdefault(csa, {})[key] = dict(sorted(vals.items()))
            out["series"][key] = {"label": label, "unit": unit, "direction": d, "source": "Baltimore Neighborhood Indicators Alliance, Vital Signs"}
        except Exception as e:
            log("trend", key, "failed:", str(e)[:160])
    if len(out["csa"]) < 40: raise RuntimeError("too few neighborhoods")
    save("trends.json", out)
    log("trends", len(out["csa"]), "neighborhoods,", list(out["series"]))


# ---------------------------------------------------------------- bus, light rail and metro schedules
FEEDS = {"bus": "https://feeds.mta.maryland.gov/gtfs/local-bus", "lightrail": "https://feeds.mta.maryland.gov/gtfs/light-rail", "metro": "https://feeds.mta.maryland.gov/gtfs/metro"}
def tile_of(lat, lon): return f"{math.floor(lat * 50)}_{math.floor(lon * 50)}"   # 0.02 degree tiles, about 2 km


def active_services(z, day):
    on = set(); ds = day.strftime("%Y%m%d"); wd = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][day.weekday()]
    if "calendar.txt" in z.namelist():
        for r in csv.DictReader(io.TextIOWrapper(z.open("calendar.txt"), encoding="utf-8-sig")):
            if r["start_date"] <= ds <= r["end_date"] and r.get(wd) == "1": on.add(r["service_id"])
    if "calendar_dates.txt" in z.namelist():
        for r in csv.DictReader(io.TextIOWrapper(z.open("calendar_dates.txt"), encoding="utf-8-sig")):
            if r["date"] == ds: (on.add if r["exception_type"] == "1" else on.discard)(r["service_id"])
    return on


def transit():
    days = [TODAY, TODAY + timedelta(days=1)]
    stops, tiles = {}, {}
    for mode, url in FEEDS.items():
        try:
            z = zipfile.ZipFile(io.BytesIO(get(url, timeout=180)))
        except Exception as e:
            log("GTFS", mode, "failed:", str(e)[:160]); continue
        routes = {r["route_id"]: (r.get("route_short_name") or r.get("route_long_name") or "").strip() for r in csv.DictReader(io.TextIOWrapper(z.open("routes.txt"), encoding="utf-8-sig"))}
        svc = [active_services(z, d) for d in days]
        trips = {}
        for r in csv.DictReader(io.TextIOWrapper(z.open("trips.txt"), encoding="utf-8-sig")):
            on = [i for i in (0, 1) if r["service_id"] in svc[i]]
            if on: trips[r["trip_id"]] = (routes.get(r["route_id"], ""), (r.get("trip_headsign") or "").strip().title(), on)
        for r in csv.DictReader(io.TextIOWrapper(z.open("stops.txt"), encoding="utf-8-sig")):
            if r.get("location_type") not in (None, "", "0"): continue
            try: lat, lon = float(r["stop_lat"]), float(r["stop_lon"])
            except (TypeError, ValueError): continue
            if in_box(lat, lon): stops[mode + ":" + r["stop_id"]] = {"name": r["stop_name"].strip(), "lat": round(lat, 5), "lon": round(lon, 5), "mode": mode, "dep": [{}, {}]}
        n = 0
        for r in csv.DictReader(io.TextIOWrapper(z.open("stop_times.txt"), encoding="utf-8-sig")):
            t = trips.get(r["trip_id"]); s = stops.get(mode + ":" + r["stop_id"])
            if not t or not s or not r.get("departure_time"): continue
            h, m, *_ = r["departure_time"].split(":"); mins = int(h) * 60 + int(m)
            for i in t[2]: s["dep"][i].setdefault(f"{t[0]}|{t[1]}", []).append(mins); n += 1
        log("GTFS", mode, len(routes), "routes,", len(trips), "trips running,", n, "departures")
    if not stops: raise RuntimeError("no GTFS data")
    for sid, s in stops.items():
        if not any(s["dep"]): continue
        s["dep"] = [{k: sorted(set(v)) for k, v in d.items()} for d in s["dep"]]
        tiles.setdefault(tile_of(s["lat"], s["lon"]), []).append({"id": sid, **s})
    tdir = os.path.join(OUT, "transit")
    os.makedirs(tdir, exist_ok=True)
    for f in os.listdir(tdir): os.remove(os.path.join(tdir, f))
    for k, v in tiles.items(): save(f"transit/{k}.json", {"days": [d.isoformat() for d in days], "stops": v})
    save("transit/index.json", {"days": [d.isoformat() for d in days], "tiles": sorted(tiles), "stops": sum(len(v) for v in tiles.values()),
                                "source": "Maryland Transit Administration GTFS schedules", "built": NOW.isoformat(timespec="minutes")})
    log("transit", len(tiles), "tiles,", sum(len(v) for v in tiles.values()), "stops with service")


if __name__ == "__main__":
    for name, fn in [("food", food), ("harbor", harbor), ("trends", trends), ("transit", transit)]:
        try: fn()
        except Exception as e: log(name, "failed, keeping the previous file:", str(e)[:200])
    sys.exit(0)
