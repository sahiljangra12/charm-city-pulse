"""One-off discovery, round 3."""
import json, urllib.request, urllib.parse, re
def j(u, t=25, h=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=h or {"User-Agent": "Mozilla/5.0"}), timeout=t) as r: return json.load(r)
    except Exception as e: return {"_err": str(e)[:150]}
def txt(u, t=25, h=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=h or {"User-Agent": "Mozilla/5.0"}), timeout=t) as r: return r.read().decode("utf-8", "replace")
    except Exception as e: return "ERR " + str(e)[:150]
def layer(url, n=3, fld="*"):
    m = j(url + "?f=json"); f = [x["name"] for x in m.get("fields", []) or []][:30]
    s = j(url + "/query?" + urllib.parse.urlencode({"where": "1=1", "outFields": fld, "returnGeometry": "false", "resultRecordCount": n, "f": "json"}))
    c = j(url + "/query?where=1%3D1&returnCountOnly=true&f=json")
    print("LAYER", url, "|", m.get("name"), m.get("geometryType"), "| count", c.get("count"), m.get("_err", ""), "\n   fields:", f, "\n   sample:", json.dumps([x.get("attributes") for x in s.get("features", [])])[:700])
for wm in ["18f22441d7de423c874caa14d7442a5a", "ced53729fcaa454581f12d4864400e8c"]:
    d = j(f"https://www.arcgis.com/sharing/rest/content/items/{wm}/data?f=json")
    for L in d.get("operationalLayers", []):
        print("WEBMAP", wm, "|", L.get("title"), "|", L.get("url"), "|", L.get("itemId"))
        if L.get("url"): layer(L["url"] if re.search(r"/\d+$", L["url"]) else L["url"] + "/0")
layer("https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/SnowRouteClassifications/FeatureServer/0")
d = j("https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/SnowRouteClassifications/FeatureServer/0/query?where=1%3D1&outFields=*&returnDistinctValues=true&returnGeometry=false&f=json&resultRecordCount=1")
for svc in ["Code_Blue_Centers", "Evacuation_Shelter"]:
    s = j(f"https://baltegis.baltimorecity.gov/server/rest/services/CityView/{svc}/MapServer?f=json"); print("SVC", svc, [(l["id"], l["name"]) for l in s.get("layers", [])])
    layer(f"https://baltegis.baltimorecity.gov/server/rest/services/CityView/{svc}/MapServer/0")
layer("https://baltegis.baltimorecity.gov/server/rest/services/CityView/Living/MapServer/1")
H = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", "Referer": "https://outagemap.bge.com/", "Accept": "application/json"}
for base in ["https://s3.amazonaws.com/outagemap.bge.com", "https://outagemap.bge.com"]:
    for p in ["/resources/data/external/interval_generation_data/metadata.json", "/default.html"]:
        t = txt(base + p, h=H); print("BGE", base + p, len(t), t[:250].replace("\n", " "))
t = txt("https://s3.amazonaws.com/outagemap.bge.com/default.html", h=H)
print("BGE refs", sorted(set(re.findall(r'(?:src|href)="([^"]+)"', t)))[:25])
for s in re.findall(r'src="([^"]+\.js[^"]*)"', t)[:8]:
    u = s if s.startswith("http") else "https://s3.amazonaws.com/outagemap.bge.com/" + s.lstrip("/")
    b = txt(u, h=H); print("JS", u, len(b), sorted(set(re.findall(r'["\'](/?[a-zA-Z0-9_./{}-]*(?:interval|metadata|report|outage|thematic)[a-zA-Z0-9_./{}-]*)["\']', b)))[:20])
md = j("https://s3.amazonaws.com/outagemap.bge.com/resources/data/external/interval_generation_data/metadata.json", h=H); print("MD", md)
if md.get("directory"):
    for f in ["report_county.json", "report.json", "data.json"]:
        print("REP", f, txt(f"https://s3.amazonaws.com/outagemap.bge.com/resources/data/external/interval_generation_data/{md['directory']}/{f}", h=H)[:600])
