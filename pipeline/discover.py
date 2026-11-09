"""One-off discovery, round 2."""
import json, urllib.request, urllib.parse, re
UA = {"User-Agent": "Mozilla/5.0 charm-city-pulse"}
def j(u, t=25):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return json.load(r)
    except Exception as e: return {"_err": str(e)[:150]}
def txt(u, t=25):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return r.read().decode("utf-8", "replace")
    except Exception as e: return "ERR " + str(e)[:150]
def layer(url, n=2):
    m = j(url + "?f=json"); f = [x["name"] for x in m.get("fields", []) or []][:45]
    s = j(url + "/query?" + urllib.parse.urlencode({"where": "1=1", "outFields": "*", "returnGeometry": "false", "resultRecordCount": n, "f": "json"}))
    c = j(url + "/query?where=1%3D1&returnCountOnly=true&f=json")
    print("LAYER", url, "|", m.get("name"), m.get("geometryType"), "| count", c.get("count"), m.get("_err", ""), "\n   fields:", f, "\n   sample:", json.dumps([x.get("attributes") for x in s.get("features", [])])[:900])
B = "https://baltegis.baltimorecity.gov"
for folder in ["/server/rest/services/CityView", "/Legacy/rest/services/CityView", "/mapping/rest/services/CityView"]:
    d = j(B + folder + "?f=json"); print("FOLDER", folder, [s["name"].split("/")[-1] for s in d.get("services", [])])
for svc in ["/server/rest/services/CityView/Living/MapServer", "/server/rest/services/CityView/Restricts_Permit_Parking/MapServer", "/server/rest/services/CityView/Evacuation_Routes/MapServer"]:
    d = j(B + svc + "?f=json"); print("SVC", svc, [(l["id"], l["name"]) for l in d.get("layers", [])])
for u in [B + "/server/rest/services/CityView/Trash_Recycle_Day/MapServer/0",
          "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/Trash_and_Recycling_Days/FeatureServer/0",
          "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/Library/FeatureServer/0",
          "https://services1.arcgis.com/mVFRs7NF4iFitgbY/arcgis/rest/services/Free_Baltimore_Wifi_Hotspots/FeatureServer/0",
          "https://services1.arcgis.com/diQbEFavWah0WAHd/arcgis/rest/services/Baltimore_UA_Master-site-list/FeatureServer/0",
          "https://services3.arcgis.com/ZTvQ9NuONePFYofE/arcgis/rest/services/CouncilDistricts_WebLayerUploader/FeatureServer/0",
          "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/Senior_Center/FeatureServer/0",
          "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services/Code_Red_Cooling_Center_New/FeatureServer/0"]:
    layer(u, 3)
d = j(B + "/server/rest/services/CityView/Trash_Recycle_Day/MapServer/0/query?where=1%3D1&outFields=DAYTEXT&returnDistinctValues=true&returnGeometry=false&f=json")
print("DISTINCT DAYTEXT", [x["attributes"]["DAYTEXT"] for x in d.get("features", [])])
for q in ["snow emergency route", "Snow_Emergency", "SnowRoutes", "snow route Baltimore City"]:
    r = j("https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": q, "num": 10, "f": "json"}))
    print("Q", q); [print("   ", x.get("owner"), "|", x.get("title"), "|", x.get("type"), "|", x.get("url"), "|", x.get("id")) for x in r.get("results", []) if re.search("balt", (x.get("owner", "") + x.get("title", "") + str(x.get("url"))), re.I)]
t = txt("https://outagemap.bge.com/")
print("BGE scripts", re.findall(r'src="([^"]+)"', t)[:15])
for s in re.findall(r'src="([^"]+\.js[^"]*)"', t)[:6]:
    u = s if s.startswith("http") else "https://outagemap.bge.com/" + s.lstrip("/")
    body = txt(u); print("JS", u, len(body), sorted(set(re.findall(r'https?://[a-zA-Z0-9./_-]*(?:kubra|interval|outage|data)[a-zA-Z0-9./_{}-]*', body)))[:15])
for u in ["https://outagemap.bge.com/resources/data/external/interval_generation_data/metadata.json", "https://outagemap.bge.com/data/interval_generation_data/metadata.json", "https://outagemap.bge.com/config.json"]:
    print("TRY", u, txt(u)[:300])
