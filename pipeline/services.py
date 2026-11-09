"""Daily city services for Charm City Pulse. Standard library only:  python pipeline/services.py

  services/trash.geojson      Trash and recycling collection day zones (Baltimore DPW)
  services/sweep.geojson      Street sweeping districts and alley sweeping neighborhoods (Baltimore DPW)
  services/snow.geojson       Snow emergency routes, where parked cars are towed during a snow emergency (Baltimore DOT)
  services/council.geojson    City Council districts with each member's office contact (Baltimore DOT layer)
  services.json               Points: libraries, free public Wi-Fi, community gardens and urban farms, trash drop-off
                              centers, senior centers, Code Blue / warming centers with hours; plus "updated".

Every part is independent: if a city server fails, the previous file is kept (and noted in services.json).
"""
import json, math, os, time, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "site", "data")
SVC = os.path.join(OUT, "services")
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}
NOW = datetime.now(timezone.utc)
DEADLINE = time.time() + 420
EGIS = "https://baltegis.baltimorecity.gov"
AGOL = "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services"


def log(*a): print("[services]", *a, flush=True)


def get(url, timeout=60):
    left = DEADLINE - time.time()
    if left < 5: raise RuntimeError("time budget used")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=min(timeout, left)) as r: return json.loads(r.read())


def query(layer, fields="*", where="1=1", offset=None):
    """All features of an ArcGIS layer as GeoJSON in WGS84 (pages through large layers)."""
    feats, start = [], 0
    while True:
        p = {"where": where, "outFields": fields, "outSR": 4326, "f": "geojson", "resultOffset": start, "resultRecordCount": 1000}
        if offset: p["maxAllowableOffset"] = offset
        page = get(layer + "/query?" + urllib.parse.urlencode(p))
        if "error" in page: raise RuntimeError(page["error"])
        fs = page.get("features", []); feats += fs
        if len(fs) < 1000 or not page.get("exceededTransferLimit", len(fs) == 1000): return feats
        start += len(fs)


def r5(x): return round(x, 5)


def trim(g):
    """Rounds coordinates to ~1 m to keep files small."""
    def t(c): return [r5(c[0]), r5(c[1])] if isinstance(c[0], (int, float)) else [t(x) for x in c]
    return {"type": g["type"], "coordinates": t(g["coordinates"])}


def fc(features): return {"type": "FeatureCollection", "features": features}


def save(name, obj):
    p = os.path.join(OUT, name); os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(obj, open(p, "w"), separators=(",", ":"))


def clean(s): return " ".join(str(s or "").split()) or None


def title(s):
    s = clean(s)
    return s.title().replace("'S ", "'s ") if s and s.isupper() else s


def pts(feats, props):
    out = []
    for f in feats:
        g = f.get("geometry") or {}
        if g.get("type") != "Point": continue
        a = f["properties"]; row = {k: (fn(a) if callable(fn) else clean(a.get(fn))) for k, fn in props.items()}
        row["lat"], row["lon"] = r5(g["coordinates"][1]), r5(g["coordinates"][0])
        out.append(row)
    return out


def merc_to_ll(x, y):
    return [r5(x / 6378137 * 180 / math.pi), r5((2 * math.atan(math.exp(y / 6378137)) - math.pi / 2) * 180 / math.pi)]


# ---------------------------------------------------------------- polygons and lines
def trash():
    fs = query(AGOL + "/Trash_and_Recycling_Days/FeatureServer/0", "trash_day,recyc_day,daytext", offset=0.00008)
    out = [{"type": "Feature", "properties": {"trash": clean(f["properties"]["trash_day"]), "recycling": clean(f["properties"]["recyc_day"])}, "geometry": trim(f["geometry"])} for f in fs if f.get("geometry")]
    if len(out) < 10: raise RuntimeError(f"only {len(out)} zones")
    save("services/trash.geojson", fc(out)); return f"{len(out)} zones"


def sweep():
    a = query(EGIS + "/server/rest/services/CityView/streetsweeping/MapServer/0", "Name,Notes", offset=0.0001)
    b = query(EGIS + "/Legacy/rest/services/CityView/AlleySweepingNeighborhoods/MapServer/0", "LABEL,Schedule", offset=0.00005)
    out = [{"type": "Feature", "properties": {"kind": "street", "name": clean(f["properties"]["Name"]), "note": clean(f["properties"]["Notes"])}, "geometry": trim(f["geometry"])} for f in a if f.get("geometry")]
    out += [{"type": "Feature", "properties": {"kind": "alley", "name": clean(f["properties"]["LABEL"]), "note": clean(f["properties"]["Schedule"])}, "geometry": trim(f["geometry"])} for f in b if f.get("geometry")]
    save("services/sweep.geojson", fc(out)); return f"{len(a)} street districts, {len(b)} alley areas"


def snow():
    """Snow emergency routes live inside DOT's public web map as an embedded feature collection (Web Mercator)."""
    d = get("https://www.arcgis.com/sharing/rest/content/items/18f22441d7de423c874caa14d7442a5a/data?f=json")
    lay = next(L for L in d["operationalLayers"] if "snow emergency" in (L.get("title") or "").lower())
    out = []
    for sub in lay["featureCollection"]["layers"]:
        for f in sub["featureSet"]["features"]:
            paths = (f.get("geometry") or {}).get("paths") or []
            if not paths: continue
            a = f["attributes"]
            name = clean(a.get("SNOWEMER")) or clean(" ".join(str(a.get(k) or "") for k in ("STDIRPRE", "ST_NAME", "ST_TYPE", "STDIRSUF")))
            out.append({"type": "Feature", "properties": {"street": name},
                        "geometry": {"type": "MultiLineString", "coordinates": [[merc_to_ll(x, y) for x, y in p] for p in paths]}})
    if len(out) < 50: raise RuntimeError(f"only {len(out)} segments")
    save("services/snow.geojson", fc(out)); return f"{len(out)} route segments"


def council():
    fs = query("https://services3.arcgis.com/ZTvQ9NuONePFYofE/arcgis/rest/services/CouncilDistricts_WebLayerUploader/FeatureServer/0",
               "AREA_NAME,CNTCT_NME,CNTCT_PHN,CNTCT_EML,totalPop", offset=0.0001)
    out = [{"type": "Feature", "properties": {"district": int(f["properties"]["AREA_NAME"]), "member": clean(f["properties"]["CNTCT_NME"]),
            "phone": clean(f["properties"]["CNTCT_PHN"]), "email": clean(f["properties"]["CNTCT_EML"]), "pop": f["properties"].get("totalPop")},
            "geometry": trim(f["geometry"])} for f in fs if f.get("geometry") and str(f["properties"].get("AREA_NAME", "")).isdigit()]
    if len(out) != 14: raise RuntimeError(f"expected 14 districts, got {len(out)}")
    out.sort(key=lambda f: f["properties"]["district"])
    save("services/council.geojson", fc(out)); return "14 districts"


# ---------------------------------------------------------------- points
def libraries():
    fs = query(AGOL + "/Library/FeatureServer/0", "name,address,cntct_phn,url")
    return pts(fs, {"name": lambda a: "Enoch Pratt Library – " + clean(a["name"]) if clean(a.get("name")) else "Enoch Pratt Library",
                    "address": "address", "phone": "cntct_phn", "url": lambda a: (clean(a.get("url")) or "https://www.prattlibrary.org/locations").replace("http://", "https://")})


def wifi():
    fs = query("https://services1.arcgis.com/mVFRs7NF4iFitgbY/arcgis/rest/services/Free_Baltimore_Wifi_Hotspots/FeatureServer/0", "siteName,siteAddress,LocationType,Status")
    live = [f for f in fs if (f["properties"].get("Status") or "").strip().upper() == "LIVE"]
    return pts(live, {"name": "siteName", "address": "siteAddress", "where": lambda a: clean((a.get("LocationType") or "").split(" - ")[-1])})


def gardens():
    fs = query("https://services1.arcgis.com/diQbEFavWah0WAHd/arcgis/rest/services/Baltimore_UA_Master-site-list/FeatureServer/0",
               "Name,Category,Neighborhood,Address,Website,Accepts_Volunteers,Community_Plots,Compost_Accepted,Status,Products")
    keep = [f for f in fs if (f["properties"].get("Status") or "").strip().lower() in ("active", "")]
    def yes(k): return lambda a: (a.get(k) or "").strip().lower().startswith("y")
    return pts(keep, {"name": "Name", "kind": "Category", "address": "Address", "neighborhood": "Neighborhood", "products": "Products",
                      "url": lambda a: ("https://" + a["Website"].strip()) if a.get("Website") and not a["Website"].strip().startswith("http") else clean(a.get("Website")),
                      "volunteers": yes("Accepts_Volunteers"), "plots": yes("Community_Plots"), "compost": yes("Compost_Accepted")})


def dropoff():
    fs = query(EGIS + "/server/rest/services/CityView/Trash_Drop_Off_Centers/MapServer/0", "NAME1,FULL_ADDR")
    return pts(fs, {"name": lambda a: title(a.get("NAME1")).replace("Substation", "Drop-off Center"), "address": lambda a: title(a.get("FULL_ADDR"))})


def seniors():
    fs = query(AGOL + "/Senior_Center/FeatureServer/0", "NAME,ADDRESS,CNTCT_PHN")
    return pts(fs, {"name": "NAME", "address": "ADDRESS", "phone": "CNTCT_PHN"})


def codeblue():
    fs = query(EGIS + "/server/rest/services/CityView/Code_Blue_Centers/MapServer/0", "SHELTER_NA,SHELTER_TY,ADDRESS,HOURS,PHONE,CAPACITY")
    return pts(fs, {"name": "SHELTER_NA", "kind": "SHELTER_TY", "address": "ADDRESS", "hours": "HOURS", "phone": "PHONE", "capacity": "CAPACITY"})


SOURCES = {
    "trash": ("Trash and recycling collection days", "Baltimore Department of Public Works", "https://www.baltimorecity.gov/publicworks/trash-collection"),
    "sweep": ("Street and alley sweeping areas", "Baltimore Department of Public Works", "https://www.baltimorecity.gov/publicworks/city-cleaning-services/mechanical-street-sweeping"),
    "snow": ("Snow emergency routes", "Baltimore City Department of Transportation", "https://transportation.baltimorecity.gov/"),
    "council": ("City Council districts", "Baltimore City Department of Transportation (GIS)", "https://www.baltimorecitycouncil.com/"),
    "libraries": ("Library branches", "Baltimore City (Open Baltimore)", "https://www.prattlibrary.org/locations"),
    "wifi": ("Free public Wi-Fi hotspots", "Baltimore City Office of Broadband & Digital Equity, via BNIA", "https://bnia-jfi.org/"),
    "gardens": ("Community gardens and urban farms", "Baltimore urban agriculture site list (UMBC)", "https://services1.arcgis.com/diQbEFavWah0WAHd/arcgis/rest/services/Baltimore_UA_Master-site-list/FeatureServer"),
    "dropoff": ("Trash and recycling drop-off centers", "Baltimore Department of Public Works", "https://www.baltimorecity.gov/publicworks/trash-recycling"),
    "seniors": ("Senior centers", "Baltimore City Health Department", "https://health.baltimorecity.gov/seniors/senior-centers"),
    "codeblue": ("Code Blue shelters and warming sites", "Baltimore City (CityView)", "https://www.baltimorecity.gov/homeless/winter-shelter"),
}


def main():
    path = os.path.join(OUT, "services.json")
    old = json.load(open(path)) if os.path.exists(path) else {}
    out = {"updated": NOW.isoformat(timespec="minutes"), "status": {}, "sources": {k: {"name": n, "by": b, "url": u} for k, (n, b, u) in SOURCES.items()}}
    ok = 0
    for name, fn in [("trash", trash), ("sweep", sweep), ("snow", snow), ("council", council)]:
        try: out["status"][name] = fn(); ok += 1; log(name, out["status"][name])
        except Exception as e: out["status"][name] = f"kept previous ({str(e)[:80]})"; log(name, "FAILED", e)
    for name, fn in [("libraries", libraries), ("wifi", wifi), ("gardens", gardens), ("dropoff", dropoff), ("seniors", seniors), ("codeblue", codeblue)]:
        try:
            out[name] = fn(); ok += 1; out["status"][name] = f"{len(out[name])} places"; log(name, len(out[name]))
            if not out[name]: raise RuntimeError("empty")
        except Exception as e:
            out[name] = old.get(name, []); out["status"][name] = f"kept previous ({str(e)[:80]})"; log(name, "FAILED", e)
    if not ok and old: out["updated"] = old.get("updated", out["updated"])   # nothing refreshed: keep the old date honest
    save("services.json", out)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
