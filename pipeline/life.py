"""Everyday-life services for Charm City Pulse. Standard library only:  python pipeline/life.py

Writes site/data/life.json with:
  clinics      Federally funded community health centers in Baltimore (HRSA): sliding-fee care for anyone, insured or not
  pharmacies   Pharmacies with their posted opening hours (OpenStreetMap)
  meals        Free meal sites for children and teens (Baltimore DHCD "Summer Meals Sites")
  schools      Baltimore City Public Schools buildings with grades
  meetings     Upcoming City Council and committee meetings, with agenda and how to join (Legistar)
  fix          How long 311 requests usually take to close, by request type (last 30 days of closed requests)
  homes        Counts of Vacants to Value homes for sale and Adopt-A-Lots available, by neighborhood

311 requests near an address, vacant building notices and residential parking zones are looked up live in the
browser (those city servers allow it), so they are always current.
Every part is independent: if a server fails, the previous value is kept and the failure is noted in "errors".
"""
import json, os, re, statistics, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "site", "data", "life.json")
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}
NOW = datetime.now(timezone.utc)
DEADLINE = time.time() + 480
AGOL = "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services"
DHCD = "https://baltegis.baltimorecity.gov/mapping/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer"
HRSA = "https://gisportal.hrsa.gov/server/rest/services/HealthCareFacilities/HealthCareFacilities/MapServer/18"
BBOX = (39.197, -76.712, 39.372, -76.529)
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"]


def log(*a): print("[life]", *a, flush=True)


def get(url, timeout=60, data=None):
    left = DEADLINE - time.time()
    if left < 5: raise RuntimeError("time budget used")
    req = urllib.request.Request(url, headers=UA, data=data)
    with urllib.request.urlopen(req, timeout=min(timeout, left)) as r: return json.loads(r.read())


def rows(layer, where="1=1", fields="*", geom=True, order=None, cap=None):
    """Attributes (+ lat/lon) of an ArcGIS layer, paging through it."""
    out, start = [], 0
    while True:
        p = {"where": where, "outFields": fields, "returnGeometry": str(geom).lower(), "outSR": 4326, "f": "json", "resultOffset": start, "resultRecordCount": 2000}
        if order: p["orderByFields"] = order
        page = get(layer + "/query?" + urllib.parse.urlencode(p))
        if "error" in page: raise RuntimeError(page["error"])
        fs = page.get("features", [])
        for f in fs:
            a = dict(f.get("attributes") or {}); g = f.get("geometry") or {}
            if "x" in g and g["x"] is not None: a["_lat"], a["_lon"] = round(g["y"], 5), round(g["x"], 5)
            out.append(a)
        if not fs or (cap and len(out) >= cap) or not page.get("exceededTransferLimit", len(fs) >= 2000): return out
        start += len(fs)


def clean(s): return " ".join(str(s or "").replace(" ", " ").split()) or None


def title(s):
    s = clean(s)
    if not s: return s
    if s.isupper() or s.islower():
        s = re.sub(r"[A-Za-z]+('[A-Za-z]+)?", lambda m: m.group(0).capitalize(), s.lower())
        s = re.sub(r"\b(Nw|Ne|Sw|Se|Ii|Iii|Llc|Ymca|Mlk|Bcps)\b", lambda m: m.group(0).upper(), s)
    return s


def phone(s):
    d = re.sub(r"\D", "", str(s or ""))[-10:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else None


# ---------------------------------------------------------------- parts
def clinics():
    out = []
    for a in rows(HRSA, "SITE_CITY='Baltimore'", "SITE_NM,SITE_ADDRESS,SITE_CITY,SITE_ZIP_CD,SITE_PHONE_NUM,SITE_URL,HCC_OPER_SCHD_DESC,TOT_OPER_HR_PER_WEEK,HCC_TYP_DESC"):
        if a.get("_lat") is None: continue
        url = clean(a.get("SITE_URL"))
        if url and not url.startswith("http"): url = "https://" + url
        out.append({"name": title(a.get("SITE_NM")), "address": title(a.get("SITE_ADDRESS")), "zip": clean(a.get("SITE_ZIP_CD")),
                    "phone": phone(a.get("SITE_PHONE_NUM")), "url": url, "schedule": clean(a.get("HCC_OPER_SCHD_DESC")),
                    "hours_week": a.get("TOT_OPER_HR_PER_WEEK"), "lat": a["_lat"], "lon": a["_lon"]})
    return sorted(out, key=lambda x: x["name"] or "")


def pharmacies():
    q = f'[out:json][timeout:60];(nwr["amenity"="pharmacy"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}););out center tags;'
    last = None
    for u in OVERPASS:
        try:
            r = get(u, 90, urllib.parse.urlencode({"data": q}).encode()); break
        except Exception as e: last = e; log("overpass", u, e)
    else: raise RuntimeError(last)
    out = []
    for e in r.get("elements", []):
        t = e.get("tags", {}); lat = e.get("lat") or (e.get("center") or {}).get("lat"); lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None: continue
        addr = " ".join(x for x in [t.get("addr:housenumber"), t.get("addr:street")] if x) or None
        out.append({"name": clean(t.get("name") or t.get("brand")) or "Pharmacy", "address": addr, "hours": clean(t.get("opening_hours")),
                    "phone": phone(t.get("phone") or t.get("contact:phone")), "lat": round(lat, 5), "lon": round(lon, 5)})
    return sorted(out, key=lambda x: x["name"])


def meals():
    out = []
    for a in rows(DHCD + "/8"):
        if a.get("_lat") is None: continue
        out.append({"name": title(a.get("Site_Name")), "address": title(a.get("JoinAddr")), "extra": clean(a.get("Address2")), "lat": a["_lat"], "lon": a["_lon"]})
    return out


def schools():
    out = []
    for a in rows(AGOL + "/BCPSS_Schools_2025/FeatureServer/0", fields="NAME,ADDRESS,GRADES,TYPE,CATEGORY"):
        if a.get("_lat") is None: continue
        out.append({"name": clean(a.get("NAME")), "address": clean(a.get("ADDRESS")), "grades": clean(a.get("GRADES")), "type": clean(a.get("TYPE")), "lat": a["_lat"], "lon": a["_lon"]})
    return sorted(out, key=lambda x: x["name"] or "")


def meetings():
    since = (NOW - timedelta(hours=30)).strftime("%Y-%m-%d")
    q = urllib.parse.urlencode({"$filter": f"EventDate ge datetime'{since}'", "$orderby": "EventDate", "$top": 40})
    out = []
    for e in get("https://webapi.legistar.com/v1/baltimore/events?" + q):
        loc = clean(e.get("EventLocation")) or ""
        link = re.search(r"https?://\S+", loc); ph = re.search(r"Phone:\s*([^;]+);\s*Code:\s*([\d ]+)", loc)
        out.append({"body": clean(e.get("EventBodyName")), "date": (e.get("EventDate") or "")[:10], "time": clean(e.get("EventTime")),
                    "where": clean(re.split(r";|Link:", loc)[0]), "join": link.group(0).rstrip(";,") if link else None,
                    "phone": f"{ph.group(1).strip()}, code {ph.group(2).strip()}" if ph else None,
                    "agenda": e.get("EventAgendaFile"), "page": e.get("EventInSiteURL"), "note": clean(e.get("EventComment"))})
    return out


def fix_times():
    since = (NOW - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    rs = rows(AGOL + "/311_Customer_Service_Requests_current/FeatureServer/0", f"SRStatus='Closed' AND CreatedDate >= TIMESTAMP '{since}'",
              "SRType,CreatedDate,CloseDate", geom=False, order="CreatedDate DESC", cap=90000)
    days = defaultdict(list)
    for a in rs:
        c, z = a.get("CreatedDate"), a.get("CloseDate")
        if c and z and z >= c: days[clean(a.get("SRType"))].append((z - c) / 86400000)
    out = {}
    for k, v in days.items():
        if k and len(v) >= 15:
            q = statistics.quantiles(v, n=4)
            out[k] = {"n": len(v), "median": round(statistics.median(v), 1), "p75": round(q[2], 1)}
    log(f"311: {len(rs)} closed requests, {len(out)} types")
    return {"since": since[:10], "types": out}


def homes():
    v2v = rows(DHCD + "/7", "Status='Available'", "Neighborhood", geom=False)
    lots = rows(DHCD + "/6", fields="Neighborhood", geom=False)
    return {"v2v": len(v2v), "lots": len(lots), "v2v_by_nb": Counter(clean(a.get("Neighborhood")) for a in v2v).most_common(),
            "lots_by_nb": Counter(clean(a.get("Neighborhood")) for a in lots).most_common()}


def main():
    prev = {}
    try: prev = json.load(open(OUT))
    except Exception: pass
    out, errors = {"updated": NOW.isoformat(timespec="minutes")}, {}
    for name, fn in [("meetings", meetings), ("clinics", clinics), ("meals", meals), ("schools", schools), ("homes", homes), ("pharmacies", pharmacies), ("fix", fix_times)]:
        try:
            out[name] = fn(); log(name, "ok", len(out[name]) if isinstance(out[name], list) else "")
        except Exception as e:
            errors[name] = str(e)[:200]; log(name, "FAILED", e)
            if name in prev: out[name] = prev[name]
    out["errors"] = errors
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    log("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
    return 0 if len(errors) < 4 else 1


if __name__ == "__main__":
    raise SystemExit(main())
