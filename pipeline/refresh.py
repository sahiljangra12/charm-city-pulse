"""Charm City Pulse data builder.

Runs daily in GitHub Actions (and locally). Pulls the newest public releases, recomputes every
indicator, and writes site/data/. Any source that fails falls back to the last good copy in
pipeline/cache/ and then to the frozen research inputs in pipeline/base/, so a bad day upstream
never breaks the site. Standard library only.

Live at build time:  ACS 5-year (Census API, newest vintage), CDC PLACES (newest tract release),
                     Baltimore City cooling centres + parks/pools/rec centres (city ArcGIS),
                     Census geocoder for shelter addresses.
Frozen research:     Landsat/MODIS heat, WorldCover land cover, heat vulnerability index
                     (Baltimore Heat Atlas), TreeBaltimore plantings (Tree Cooling study), SVI 2022.
"""
import csv, json, math, os, re, sys, time, urllib.parse, urllib.request
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, "base")
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(os.path.dirname(HERE), "site", "data")
os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
OFFLINE = "--offline" in sys.argv
NOW = datetime.now(timezone.utc)
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}
SOURCES = {}   # key -> metadata shown in the app's References / Live data pages


def log(*a): print("[refresh]", *a, flush=True)


def fetch(url, tries=3, timeout=90, data=None):
    if OFFLINE: raise RuntimeError("offline")
    err = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            err = e; time.sleep(2 * (k + 1))
    raise RuntimeError(f"{url[:120]}: {err}")


def fjson(url, **kw): return json.loads(fetch(url, **kw))
def cache_put(name, obj): json.dump(obj, open(os.path.join(CACHE, name), "w"), separators=(",", ":"))
def cache_get(name):
    p = os.path.join(CACHE, name)
    return json.load(open(p)) if os.path.exists(p) else None


def num(v):
    try:
        x = float(v)
        return None if math.isnan(x) or x <= -99999 else x   # Census sentinels are large negatives
    except (TypeError, ValueError):
        return None


def src(key, **kw):
    SOURCES[key] = {"retrieved": NOW.isoformat(timespec="minutes"), **kw}


# --------------------------------------------------------------------------- base inputs
geo = json.load(open(os.path.join(BASE, "tracts_geo.json")))
atlas = {r["GEOID"]: r for r in csv.DictReader(open(os.path.join(BASE, "atlas_tracts.csv")))}
IDS = [f["properties"]["id"] for f in geo["features"]]
T = {i: {} for i in IDS}                       # tract -> indicator values
COUNTS = {i: {} for i in IDS}                  # tract -> raw ACS counts for proper CSA aggregation
for f in geo["features"]:
    p = f["properties"]; t = T[p["id"]]
    t.update(id=p["id"], name="Tract " + p["name"], csa=p["csa"] or "Unassigned", aland_m2=p["aland_m2"])

# Non-residential / no-data tracts are shown on the map but excluded from rankings
NONRES = {}
for i in IDS:
    a = atlas[i]
    if (T[i]["csa"] or "").lower().startswith("unassigned -- jail"):
        NONRES[i] = "Correctional facility (Baltimore City jail complex), not a residential neighborhood"
    elif num(a.get("pop2020")) in (None, 0):
        NONRES[i] = "No resident population in the 2020 Census"

# --------------------------------------------------------------------------- ACS (newest 5-year)
ACS_SPEC = {   # indicator: (numerator cells, denominator cell)  — same definitions as the Heat Atlas
    "pct_65plus": ([f"B01001_{n:03d}" for n in list(range(20, 26)) + list(range(44, 50))], "B01001_001"),
    "pct_under5": (["B01001_003", "B01001_027"], "B01001_001"),
    "pct_poverty": (["B17001_002"], "B17001_001"),
    "pct_no_vehicle": (["B25044_003", "B25044_010"], "B25044_001"),
    "pct_65_alone": (["B11007_003"], "B11007_001"),
    "pct_black_nh": (["B03002_004"], "B03002_001"),
    "pct_white_nh": (["B03002_003"], "B03002_001"),
    "pct_hispanic": (["B03002_012"], "B03002_001"),
    "pct_pre1940": (["B25034_011"], "B25034_001"),
    "pct_renter": (["B25003_003"], "B25003_001"),
    "pct_no_hs": ([f"B15003_{n:03d}" for n in range(2, 17)], "B15003_001"),
    "pct_disability": ([f"B18101_{n:03d}" for n in [4, 7, 10, 13, 16, 19, 23, 26, 29, 32, 35, 38]], "B18101_001"),
    "pct_unemployed": (["B23025_005"], "B23025_003"),
    "pct_limited_english": ([f"C16002_{n:03d}" for n in [4, 7, 10, 13]], "C16002_001"),
    "pct_rent_burden50": (["B25070_010"], "B25070_001"),
    "pct_no_internet": (["B28002_013"], "B28002_001"),
    "pct_uninsured": ([f"B27010_{n:03d}" for n in [17, 33, 50, 66]], "B27010_001"),
    "pct_crowded": ([f"B25014_{n:03d}" for n in [5, 6, 7, 11, 12, 13]], "B25014_001"),
}
INC_BRACKETS = [(0, 10000), (10000, 15000), (15000, 20000), (20000, 25000), (25000, 30000), (30000, 35000),
                (35000, 40000), (40000, 45000), (45000, 50000), (50000, 60000), (60000, 75000), (75000, 100000),
                (100000, 125000), (125000, 150000), (150000, 200000), (200000, 250000)]
GROUPS = sorted({c.split("_")[0] for num_, den in ACS_SPEC.values() for c in num_ + [den]} | {"B19013", "B19001", "B01003"})


def acs_download():
    year0 = NOW.year - 1
    for y in range(year0, year0 - 4, -1):
        base = f"https://api.census.gov/data/{y}/acs/acs5"
        try:
            fetch(f"{base}?get=NAME&for=state:24", tries=1, timeout=30)
        except Exception:
            continue
        cells = {}
        for g in GROUPS:
            rows = fjson(f"{base}?get=group({g})&for=tract:*&in=state:24%20county:510")
            head = rows[0]
            for r in rows[1:]:
                d = dict(zip(head, r)); gid = d["GEO_ID"][-11:]
                cells.setdefault(gid, {}).update({k: d[k] for k in head if re.match(r"^[BC]\d+_\d{3}[EM]$", k)})
            log("ACS", y, g, len(rows) - 1, "tracts")
        return {"vintage": y, "cells": cells}
    raise RuntimeError("no ACS 5-year vintage reachable")


def share(cells, nums, den):
    e = [num(cells.get(c + "E")) for c in nums]; m = [num(cells.get(c + "M")) for c in nums]
    d = num(cells.get(den + "E")); md = num(cells.get(den + "M")) or 0
    if d in (None, 0) or any(x is None for x in e): return None, None, None, None
    n_ = sum(e); mn = math.sqrt(sum((x or 0) ** 2 for x in m)); p = n_ / d
    rad = mn ** 2 - p ** 2 * md ** 2
    if rad < 0: rad = mn ** 2 + p ** 2 * md ** 2
    return 100 * p, 100 * math.sqrt(rad) / d, (n_, mn), (d, md)


acs = None
try:
    acs = acs_download(); cache_put("acs.json", acs)
    src("acs", name="American Community Survey 5-year estimates", by="U.S. Census Bureau",
        vintage=f"{acs['vintage'] - 4}–{acs['vintage']}", url="https://api.census.gov/data.html", status="live")
except Exception as e:
    log("ACS download failed:", e); acs = cache_get("acs.json")
    if acs: src("acs", name="American Community Survey 5-year estimates", by="U.S. Census Bureau",
                vintage=f"{acs['vintage'] - 4}–{acs['vintage']}", url="https://api.census.gov/data.html", status="cached")

if acs:
    for i in IDS:
        c = acs["cells"].get(i, {})
        for k, (nums, den) in ACS_SPEC.items():
            v, m, nm, dd = share(c, nums, den)
            T[i][k], T[i][k + "_moe"] = v, m
            if nm: COUNTS[i][k] = (nm, dd)
        T[i]["median_income"] = num(c.get("B19013_001E")); T[i]["median_income_moe"] = num(c.get("B19013_001M"))
        T[i]["pop_acs"] = num(c.get("B01003_001E"))
        COUNTS[i]["inc_brackets"] = [num(c.get(f"B19001_{n:03d}E")) or 0 for n in range(2, 18)]
else:
    log("using Heat Atlas ACS 2020–2024 values")
    src("acs", name="American Community Survey 5-year estimates", by="U.S. Census Bureau", vintage="2020–2024",
        url="https://api.census.gov/data.html", status="frozen (Heat Atlas)")
    for i in IDS:
        a = atlas[i]
        for k in list(ACS_SPEC) + ["median_income"]:
            T[i][k] = num(a.get(k)); T[i][k + "_moe"] = num(a.get(k + "_moe"))
        T[i]["pop_acs"] = num(a.get("pop_acs"))

# --------------------------------------------------------------------------- CDC PLACES (newest tract release)
PL = ["CASTHMA", "COPD", "CHD", "BPHIGH", "DIABETES", "OBESITY", "STROKE", "MHLTH", "GHLTH", "CSMOKING", "ACCESS2",
      "DISABILITY", "MOBILITY", "LONELINESS", "SHUTUTILITY", "HOUSINSECU", "LACKTRPT", "FOODINSECU"]


def places_download():
    cat = fjson("https://api.us.socrata.com/api/catalog/v1?domains=data.cdc.gov&search_context=data.cdc.gov"
                "&only=datasets&limit=50&q=" + urllib.parse.quote("PLACES Census Tract Data"))
    best = None
    for r in cat.get("results", []):
        nm = r["resource"]["name"]
        mt = re.search(r"PLACES: Local Data for Better Health, Census Tract Data (\d{4}) release", nm)
        if mt and "GIS" not in nm and (not best or int(mt.group(1)) > best[0]):
            best = (int(mt.group(1)), r["resource"]["id"], nm)
    if not best: raise RuntimeError("PLACES tract dataset not found in catalog")
    rel, did, nm = best
    rows = fjson(f"https://data.cdc.gov/resource/{did}.json?$where=countyfips='24510'&$limit=50000")
    out = {}
    for r in rows:
        gid = next((r[k] for k in ("locationid", "locationname") if k in r and len(str(r[k])) == 11), None)
        if not gid or r.get("measureid") not in PL or r.get("data_value") is None: continue
        o = out.setdefault(gid, {"pop18": num(r.get("totalpop18plus")), "year": r.get("year")})
        o[r["measureid"]] = [num(r["data_value"]), num(r.get("low_confidence_limit")), num(r.get("high_confidence_limit"))]
    if len(out) < 150: raise RuntimeError(f"PLACES returned only {len(out)} tracts")
    log("PLACES", rel, did, len(out), "tracts")
    return {"release": rel, "id": did, "tracts": out}


pl = None
try:
    pl = places_download(); cache_put("places.json", pl); pl_status = "live"
except Exception as e:
    log("PLACES download failed:", e); pl = cache_get("places.json"); pl_status = "cached"
if pl:
    yrs = sorted({v.get("year") for v in pl["tracts"].values() if v.get("year")})
    src("places", name="PLACES: Local Data for Better Health (census tract)", by="Centers for Disease Control and Prevention",
        vintage=f"{pl['release']} release (BRFSS {', '.join(map(str, yrs))})", url=f"https://data.cdc.gov/d/{pl['id']}", status=pl_status)
    for i in IDS:
        d = pl["tracts"].get(i, {})
        T[i]["pop18"] = d.get("pop18")
        for k in PL:
            v = d.get(k)
            T[i]["pl_" + k] = v[0] if v else None
            T[i]["pl_" + k + "_se"] = (v[2] - v[1]) / 3.92 if v and v[1] is not None and v[2] is not None else None
else:
    src("places", name="PLACES: Local Data for Better Health (census tract)", by="Centers for Disease Control and Prevention",
        vintage="2025 release (BRFSS 2023)", url="https://www.cdc.gov/places/", status="frozen (Heat Atlas)")
    for i in IDS:
        for k in PL:
            T[i]["pl_" + k] = num(atlas[i].get("pl_" + k)); T[i]["pl_" + k + "_se"] = num(atlas[i].get("pl_" + k + "_se"))

# --------------------------------------------------------------------------- frozen research layers
for i in IDS:
    a = atlas[i]
    for k in ["pop2020", "hvi", "lst_popw_c", "modis_myd_night_c", "lst_anom_c", "lst_c_p90", "dist_cool_km",
              "score_exposure", "score_sensitivity", "score_low_capacity", "pct_tree", "pct_grass", "pct_built", "ndvi",
              "holc_score", "svi_themes", "rank_lo90", "rank_hi90"]:
        T[i][k] = num(a.get(k))
    T[i]["hvi_class"] = a.get("hvi_class") or None
    T[i]["holc_grade"] = a.get("holc_grade") or None
src("heat", name="Baltimore Heat Atlas: surface temperature, land cover and heat vulnerability index", by="Sahil (Johns Hopkins University)",
    vintage="Landsat 8/9 summers 2019–2025; MODIS Aqua night LST; ESA WorldCover 2021; HVI Oct 2026", url="https://github.com/sahiljangra12/baltimore-heat-atlas", status="research release")
src("svi", name="CDC/ATSDR Social Vulnerability Index", by="CDC/ATSDR", vintage="2022 (Maryland ranking)", url="https://www.atsdr.cdc.gov/place-health/php/svi/", status="research release")
src("holc", name="Mapping Inequality: Redlining in New Deal America (HOLC 1937 maps)", by="Nelson, Winling et al., University of Richmond",
    vintage="1937 survey", url="https://dsl.richmond.edu/panorama/redlining/", status="historical")

tree = json.load(open(os.path.join(BASE, "tree_csa.json")))
CSA_FIX = {"Oliver/Johnston Square": "Oliver/Johnson Square"}
src("trees", name="Street-tree plantings 2013–2020 by neighborhood (TreeBaltimore records)", by="Sahil, Baltimore Tree Cooling study",
    vintage="Plantings 2013–2020; city inventory 2017–18", url="https://github.com/sahiljangra12/baltimore-tree-cooling", status="research release")

# --------------------------------------------------------------------------- indicator catalog
C = [  # key, label, unit, category, direction, source key, decimals, uncertainty kind, level
 ("hvi", "Heat vulnerability index", "0–1", "Heat", 1, "heat", 3, None, "tract"),
 ("lst_popw_c", "Daytime summer surface temperature where people live", "°C", "Heat", 1, "heat", 1, None, "tract"),
 ("modis_myd_night_c", "Night-time summer surface temperature", "°C", "Heat", 1, "heat", 1, None, "tract"),
 ("lst_anom_c", "Surface temperature above the city median", "°Cd", "Heat", 1, "heat", 1, None, "tract"),
 ("lst_c_p90", "Hottest 10% of ground (90th percentile)", "°C", "Heat", 1, "heat", 1, None, "tract"),
 ("dist_cool_km", "Distance to the nearest cooling center", "km", "Heat", 1, "heat", 2, None, "tract"),
 ("score_exposure", "Heat exposure sub-score", "0–1", "Heat", 1, "heat", 3, None, "tract"),
 ("score_sensitivity", "Heat sensitivity sub-score", "0–1", "Heat", 1, "heat", 3, None, "tract"),
 ("score_low_capacity", "Low adaptive capacity sub-score", "0–1", "Heat", 1, "heat", 3, None, "tract"),
 ("pct_tree", "Tree cover", "%", "Trees & green space", -1, "heat", 1, None, "tract"),
 ("pct_grass", "Grass cover", "%", "Trees & green space", -1, "heat", 1, None, "tract"),
 ("pct_built", "Built-up surface", "%", "Trees & green space", 1, "heat", 1, None, "tract"),
 ("ndvi", "Greenness (NDVI)", "index", "Trees & green space", -1, "heat", 3, None, "tract"),
 ("trees_planted_km2", "Street trees planted 2013–2020 per km²", "per km²", "Trees & green space", -1, "trees", 0, None, "csa"),
 ("pl_CASTHMA", "Current asthma (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_COPD", "COPD (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_CHD", "Coronary heart disease (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_BPHIGH", "High blood pressure (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_DIABETES", "Diabetes (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_OBESITY", "Obesity (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_STROKE", "Stroke (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_MHLTH", "Frequent mental distress (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_GHLTH", "Fair or poor general health (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_CSMOKING", "Current smoking (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_ACCESS2", "No health insurance (adults 18–64)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_DISABILITY", "Any disability (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_MOBILITY", "Mobility disability (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("pl_LONELINESS", "Loneliness (adults)", "%", "Health", 1, "places", 1, "se", "tract"),
 ("svi_themes", "Social vulnerability (overall SVI percentile)", "0–1", "Social vulnerability", 1, "svi", 3, None, "tract"),
 ("pct_poverty", "Below the poverty line", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("median_income", "Median household income", "$", "Social vulnerability", -1, "acs", 0, "moe90", "tract"),
 ("pct_unemployed", "Unemployed (labor force)", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_no_hs", "Adults 25+ without a high-school diploma", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_uninsured", "No health insurance", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_limited_english", "Limited-English households", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_65plus", "Residents aged 65+", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_under5", "Children under 5", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_disability", "Residents with a disability", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pct_65_alone", "Households: one person 65+ living alone", "%", "Social vulnerability", 1, "acs", 1, "moe90", "tract"),
 ("pl_SHUTUTILITY", "Threat of utility shut-off in the past year (adults)", "%", "Housing & energy", 1, "places", 1, "se", "tract"),
 ("pl_HOUSINSECU", "Housing insecurity (adults)", "%", "Housing & energy", 1, "places", 1, "se", "tract"),
 ("pct_pre1940", "Homes built before 1940", "%", "Housing & energy", 1, "acs", 1, "moe90", "tract"),
 ("pct_renter", "Renter-occupied homes", "%", "Housing & energy", 0, "acs", 1, "moe90", "tract"),
 ("pct_rent_burden50", "Renters paying 50%+ of income on rent", "%", "Housing & energy", 1, "acs", 1, "moe90", "tract"),
 ("pct_crowded", "Crowded homes (more than 1 person per room)", "%", "Housing & energy", 1, "acs", 1, "moe90", "tract"),
 ("pct_no_internet", "Households with no internet", "%", "Housing & energy", 1, "acs", 1, "moe90", "tract"),
 ("pct_no_vehicle", "Households with no vehicle", "%", "Food & mobility", 1, "acs", 1, "moe90", "tract"),
 ("pl_LACKTRPT", "Lack of reliable transportation (adults)", "%", "Food & mobility", 1, "places", 1, "se", "tract"),
 ("pl_FOODINSECU", "Food insecurity (adults)", "%", "Food & mobility", 1, "places", 1, "se", "tract"),
 ("holc_score", "1937 redlining score (1 = grade A, 4 = grade D)", "1–4", "History & equity", 1, "holc", 2, None, "tract"),
 ("pop2020", "Population", "people", "Population", 0, "census2020", 0, None, "tract"),
 ("pct_black_nh", "Black (non-Hispanic)", "%", "Population", 0, "acs", 1, "moe90", "tract"),
 ("pct_white_nh", "White (non-Hispanic)", "%", "Population", 0, "acs", 1, "moe90", "tract"),
 ("pct_hispanic", "Hispanic or Latino", "%", "Population", 0, "acs", 1, "moe90", "tract"),
]
src("census2020", name="2020 Decennial Census redistricting data", by="U.S. Census Bureau", vintage="2020", url="https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html", status="fixed")
THEMES = {
 "heat": ("Heat", ["lst_popw_c", "modis_myd_night_c"]),
 "trees": ("Trees & shade", ["pct_tree", "ndvi"]),
 "health": ("Health sensitivity", ["pl_CASTHMA", "pl_COPD", "pl_CHD", "pl_DIABETES"]),
 "social": ("Social vulnerability", ["svi_themes", "pct_poverty"]),
 "energy": ("Housing & energy strain", ["pl_SHUTUTILITY", "pl_HOUSINSECU", "pct_rent_burden50", "pct_pre1940"]),
 "mobility": ("Getting around & food", ["pct_no_vehicle", "pl_LACKTRPT", "pl_FOODINSECU"]),
}
IND = {c[0]: c for c in C}


def rel_cv(rec, key):
    """Coefficient of variation of an estimate (ACS MOE at 90% or PLACES SE)."""
    c = IND[key]; v = rec.get(key)
    if c[7] is None or v in (None, 0): return None
    u = rec.get(key + ("_moe" if c[7] == "moe90" else "_se"))
    if u is None: return None
    se = u / 1.645 if c[7] == "moe90" else u
    return se / abs(v)


# --------------------------------------------------------------------------- CSA aggregation (proper)
def interp_median(brackets):
    tot = sum(brackets)
    if tot <= 0: return None
    half, cum = tot / 2, 0
    for (lo, hi), n in zip(INC_BRACKETS + [(250000, None)], brackets):
        if cum + n >= half:
            if hi is None: return 250000.0
            return lo + (half - cum) / n * (hi - lo) if n else lo
        cum += n
    return None


groups = {}
for i in IDS:
    if i in NONRES: continue
    groups.setdefault(T[i]["csa"], []).append(i)
CSA = {}
POPW = {"lst_popw_c", "modis_myd_night_c", "dist_cool_km", "hvi", "score_exposure", "score_sensitivity", "score_low_capacity", "svi_themes", "holc_score"}
AREAW = {"pct_tree", "pct_grass", "pct_built", "ndvi", "lst_anom_c", "lst_c_p90"}
for name, ids in sorted(groups.items()):
    if name.lower().startswith("unassigned"): continue
    o = {"id": "csa:" + name, "name": name, "tracts": ids}
    for k, c in IND.items():
        if k == "trees_planted_km2":
            t = tree.get(CSA_FIX.get(name, name)); o[k] = t["planted_2013_2020"] / t["area_km2"] if t else None; continue
        if k == "pop2020": o[k] = sum(T[i]["pop2020"] or 0 for i in ids); continue
        if c[5] == "acs" and k != "median_income" and all(k in COUNTS[i] for i in ids):
            ns = [COUNTS[i][k] for i in ids]
            n_ = sum(x[0][0] for x in ns); mn = math.sqrt(sum(x[0][1] ** 2 for x in ns))
            d = sum(x[1][0] for x in ns); md = math.sqrt(sum(x[1][1] ** 2 for x in ns))
            if d > 0:
                p = n_ / d; rad = mn ** 2 - p ** 2 * md ** 2
                if rad < 0: rad = mn ** 2 + p ** 2 * md ** 2
                o[k], o[k + "_moe"] = 100 * p, 100 * math.sqrt(rad) / d
            continue
        if k == "median_income" and all("inc_brackets" in COUNTS[i] for i in ids):
            br = [sum(COUNTS[i]["inc_brackets"][j] for i in ids) for j in range(16)]
            o[k] = interp_median(br); o["median_income_method"] = "interpolated from pooled ACS income brackets (B19001)"; continue
        w = [(T[i].get("aland_m2") if k in AREAW else (T[i].get("pop18") or T[i].get("pop2020")) if c[5] == "places" else T[i].get("pop2020")) or 0 for i in ids]
        vs = [(T[i].get(k), wt) for i, wt in zip(ids, w) if T[i].get(k) is not None and wt]
        o[k] = sum(v * wt for v, wt in vs) / sum(wt for _, wt in vs) if vs else None
        if k == "median_income" and o[k] is not None: o["median_income_method"] = "population-weighted average of tract medians (approximate)"
    CSA[name] = o
for i in IDS:   # tracts inherit the neighbourhood-level planting rate for display only
    t = tree.get(CSA_FIX.get(T[i]["csa"], T[i]["csa"])); T[i]["trees_planted_km2"] = t["planted_2013_2020"] / t["area_km2"] if t else None


# --------------------------------------------------------------------------- percentiles & themes
def pct_rank(pairs, direction):
    vals = sorted(v for _, v in pairs); n = len(vals); out = {}
    for key, v in pairs:
        lo = next(j for j, x in enumerate(vals) if x >= v); hi = n - 1 - next(j for j, x in enumerate(reversed(vals)) if x <= v)
        pc = 100 * ((lo + hi) / 2) / (n - 1) if n > 1 else 50
        out[key] = round(pc if direction >= 0 else 100 - pc, 1)
    return out


for recs, keyf in ((T, lambda i: i), (CSA, lambda n: n)):
    for k, c in IND.items():
        if c[8] == "csa" and recs is T: continue
        pairs = [(key, r[k]) for key, r in recs.items() if r.get(k) is not None and (recs is CSA or key not in NONRES)]
        for key, pc in pct_rank(pairs, c[4]).items(): recs[key]["pc_" + k] = pc
    for tk, (_, ins) in THEMES.items():
        for key, r in recs.items():
            if recs is T and key in NONRES: r["t_" + tk] = None; continue
            xs = [r.get("pc_" + k) for k in ins if r.get("pc_" + k) is not None]
            r["t_" + tk] = round(sum(xs) / len(xs), 1) if xs else None
            flags = [k for k in ins if (rel_cv(r, k) or 0) > 0.3]
            if flags: r["u_" + tk] = flags

# --------------------------------------------------------------------------- centres (live where possible)
def geocode(addr, gcache):
    if addr in gcache: return gcache[addr]
    try:
        j = fjson("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" + urllib.parse.quote(addr), timeout=40)
        m = j["result"]["addressMatches"]
        gcache[addr] = [m[0]["coordinates"]["y"], m[0]["coordinates"]["x"]] if m else None
    except Exception as e:
        log("geocode failed", addr, e); return None
    return gcache[addr]


def city_cooling():
    hub = fjson("https://data.baltimorecity.gov/api/search/v1/collections/all/items?limit=20&q=" + urllib.parse.quote("cooling center"))
    for it in hub.get("features", []):
        p = it.get("properties", {}); url = p.get("url") or ""
        if "cool" not in (p.get("title", "") + url).lower() or "Server" not in url: continue
        layer = url if re.search(r"/\d+$", url) else url.rstrip("/") + "/0"
        g = fjson(layer + "/query?where=1%3D1&outFields=*&outSR=4326&f=geojson")
        feats = [f for f in g.get("features", []) if f.get("geometry")]
        if len(feats) < 8: continue
        def pick(pr, *keys):
            for k in pr:
                if any(s in k.lower() for s in keys) and pr[k] not in (None, "", " "): return str(pr[k]).strip()
            return ""
        out = []
        for f in feats:
            pr = f["properties"]; x, y = f["geometry"]["coordinates"][:2]
            if not (39.15 < y < 39.40 and -76.75 < x < -76.50): continue
            out.append({"name": pick(pr, "name", "site", "facil", "locat") or "Cooling center", "address": pick(pr, "addr", "street"),
                        "type": pick(pr, "type", "categ") or "Cooling center", "hours": pick(pr, "hour", "time", "open"), "lat": y, "lon": x})
        if len(out) >= 8: return out, p.get("title"), it.get("id"), layer
    raise RuntimeError("no city cooling-centre layer found")


cool = json.load(open(os.path.join(BASE, "cooling_2025.json")))
try:
    live, title, item, layer = city_cooling(); cool = live; cache_put("cooling.json", live)
    src("cooling", name=f"Baltimore City cooling centers ({title})", by="Baltimore City Health Department / Open Baltimore", vintage="current city layer", url=layer, status="live")
except Exception as e:
    log("city cooling layer:", e); c2 = cache_get("cooling.json")
    if c2: cool = c2
    src("cooling", name="Baltimore City Code Red cooling centers", by="Baltimore City Health Department", vintage="2025 season list" if not c2 else "last city layer",
        url="https://data.baltimorecity.gov/datasets/code-red-cooling-center", status="cached" if c2 else "frozen (2025 list)")

winter = json.load(open(os.path.join(BASE, "winter_2026_27.json")))
gcache = cache_get("geocode.json") or {}
known = {c["address"].split(",")[0].lower().replace(".", ""): (c["lat"], c["lon"]) for c in cool}
for s in winter["sites"]:
    k = s["address"].split(",")[0].lower().replace(".", "")
    ll = geocode(s["address"], gcache) or known.get(k)
    s["lat"], s["lon"] = (ll if ll else (None, None))
cache_put("geocode.json", gcache)
src("winter", name="FY 2027 Winter Shelter & Code Purple Plan", by="Baltimore City Mayor's Office of Homeless Services", vintage="Nov 15, 2026 – Mar 15, 2027",
    url=winter["source_url"], status=f"verified {winter['verified']}")


def city_layer(n, keep):
    g = fjson(f"https://geodata.baltimorecity.gov/egis/rest/services/CityView/BCRPServices/FeatureServer/{n}/query?where=1%3D1&outFields=*&outSR=4326&geometryPrecision=5&f=geojson", timeout=120)
    for f in g["features"]:
        pr = f["properties"]; f["properties"] = {k2: pr.get(k1) for k1, k2 in keep.items() if k1 in pr}
        f["properties"]["name"] = f["properties"].get("name") or next((str(v) for k, v in pr.items() if "name" in k.lower() and v), "")
    return g


layers_ok = {}
for n, fname, keep in [(4, "parks.geojson", {"NAME": "name", "ACRES": "acres"}), (2, "pools.geojson", {"NAME": "name", "ADDRESS": "address", "TYPE": "type"}),
                       (1, "rec_centers.geojson", {"NAME": "name", "ADDRESS": "address"})]:
    try:
        g = city_layer(n, keep)
        if len(g["features"]) < 3: raise RuntimeError("too few features")
        json.dump(g, open(os.path.join(OUT, fname), "w"), separators=(",", ":")); layers_ok[fname] = len(g["features"])
    except Exception as e:
        log("city layer", n, e)
if layers_ok:
    src("parks", name="Parks, pools and recreation centers (BCRP)", by="Baltimore City Department of Recreation & Parks", vintage="current city layer",
        url="https://geodata.baltimorecity.gov/egis/rest/services/CityView/BCRPServices/FeatureServer", status="live", counts=layers_ok)

# --------------------------------------------------------------------------- write
def rnd(v, d):
    return None if v is None else round(v, d)


DEC = {c[0]: c[6] for c in C}
def clean(rec):
    o = {}
    for k, v in rec.items():
        if isinstance(v, float):
            base = re.sub(r"_(moe|se)$", "", re.sub(r"^(pc_|t_)", "", k)); o[k] = rnd(v, 1 if k.startswith(("pc_", "t_")) else DEC.get(base, 2))
        elif k in ("tracts",) or not isinstance(v, (list, dict)) or k.startswith("u_"): o[k] = v
    return o


feats = []
for f in geo["features"]:
    i = f["properties"]["id"]; r = clean(T[i])
    if i in NONRES: r["nonres"] = NONRES[i]
    feats.append({"type": "Feature", "properties": r, "geometry": f["geometry"]})
json.dump({"type": "FeatureCollection", "features": feats}, open(os.path.join(OUT, "tracts.geojson"), "w"), separators=(",", ":"))
json.dump([clean(v) for v in CSA.values()], open(os.path.join(OUT, "csa.json"), "w"), separators=(",", ":"))
json.dump({
    "indicators": [{"key": k, "label": l, "unit": u, "category": cat, "direction": d, "source": s, "vintage": SOURCES.get(s, {}).get("vintage"),
                    "decimals": dc, "uncertainty": unc, "level": lvl} for k, l, u, cat, d, s, dc, unc, lvl in C],
    "themes": [{"key": k, "label": v[0], "inputs": v[1]} for k, v in THEMES.items()],
}, open(os.path.join(OUT, "catalog.json"), "w"), indent=1)
json.dump({"cooling": cool, "winter": winter}, open(os.path.join(OUT, "centers.json"), "w"), indent=1)
json.dump(json.load(open(os.path.join(BASE, "research.json"))), open(os.path.join(OUT, "research.json"), "w"), indent=1)
meta = {"built": NOW.isoformat(timespec="seconds"), "sources": SOURCES,
        "tracts": len(IDS), "residential_tracts": len(IDS) - len(NONRES), "csas": len(CSA), "nonres": NONRES}
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
log("done:", len(IDS), "tracts,", len(CSA), "CSAs; sources:", {k: v["status"] for k, v in SOURCES.items()})
