"""One-off probe, round 3: fields of the remaining layers, CORS for live browser queries, and photo candidates."""
import json, re, urllib.request, urllib.parse


def j(u, t=40, h=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", **(h or {})}), timeout=t) as r:
            return json.load(r)
    except Exception as e:
        return {"_err": str(e)[:120]}


def layer(url, where="1=1", n=2):
    m = j(url + "?f=json")
    s = j(url + "/query?" + urllib.parse.urlencode({"where": where, "outFields": "*", "returnGeometry": "false", "resultRecordCount": n, "f": "json"}))
    print("LAYER", url.split("/services/")[-1], "|", m.get("name"), m.get("geometryType"), m.get("maxRecordCount"), m.get("_err", ""))
    print("   fields:", [x["name"] for x in m.get("fields", []) or []][:40])
    print("   sample:", json.dumps([x.get("attributes") for x in s.get("features", [])])[:700])


def cors(u):
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", "Origin": "https://sahiljangra12.github.io"})
        with urllib.request.urlopen(req, timeout=30) as r:
            print("CORS", u[:90], "->", r.headers.get("Access-Control-Allow-Origin"))
    except Exception as e:
        print("CORS", u[:90], "ERR", e)


A = "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services"
D = "https://baltegis.baltimorecity.gov/mapping/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer"
for i in (6, 7, 8): layer(f"{D}/{i}")
layer(A + "/BCPSS_Schools_2025/FeatureServer/0")
s = j(A + "/BCRP_Asset_Inventory_view/FeatureServer?f=json"); print("BCRP assets layers", [(l["id"], l["name"]) for l in s.get("layers", [])], s.get("_err", ""))
cors(A + "/311_Customer_Service_Requests_current/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json")
cors(D + "/1/query?where=1%3D1&returnCountOnly=true&f=json")
cors(A + "/Residential_Parking_Permits/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json")
cors("https://webapi.legistar.com/v1/baltimore/events?$top=1")
q = A + "/311_Customer_Service_Requests_current/FeatureServer/0/query?" + urllib.parse.urlencode({"where": "SRStatus='Closed' AND CreatedDate > CURRENT_TIMESTAMP - 60", "returnCountOnly": "true", "f": "json"})
print("311 closed last 60 days", j(q))
ev = j("https://webapi.legistar.com/v1/baltimore/events?" + urllib.parse.urlencode({"$filter": "EventDate ge datetime'2026-11-26'", "$orderby": "EventDate", "$top": 3}))
print("UPCOMING", json.dumps(ev)[:900])

QS = ["Baltimore farmers market", "Waverly farmers market Baltimore", "Enoch Pratt Free Library Central", "Baltimore rowhouses street", "Baltimore City Hall",
      "Johns Hopkins Hospital", "Baltimore playground", "Patterson Park Baltimore", "Druid Hill Park reservoir", "Baltimore Light Rail", "Charm City Circulator",
      "Baltimore Penn Station", "Lexington Market", "Fells Point Baltimore", "Baltimore Washington Monument Mount Vernon", "Baltimore school building",
      "Baltimore community garden", "Hampden Baltimore 36th Street", "Baltimore mural", "Baltimore Book Festival", "Baltimore Artscape", "Baltimore pharmacy"]
for qq in QS:
    p = {"action": "query", "generator": "search", "gsrsearch": qq + " filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 8,
         "prop": "imageinfo", "iiprop": "size|extmetadata", "format": "json"}
    r = j("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), h={"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"})
    print("\nPHOTOS:", qq)
    for pg in sorted((r.get("query") or {}).get("pages", {}).values(), key=lambda x: x.get("index", 0)):
        ii = (pg.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        art = re.sub("<[^>]+>", "", md.get("Artist", {}).get("value", ""))[:40]
        print(f"   {ii.get('width')}x{ii.get('height')} | {md.get('LicenseShortName', {}).get('value')} | {art} | {pg['title']}")
