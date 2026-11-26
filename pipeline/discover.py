"""One-off probe for new life-service data sources."""
import json, urllib.request, urllib.parse, re


def j(u, t=30, h=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=h or {"User-Agent": "Mozilla/5.0"}), timeout=t) as r:
            return json.load(r)
    except Exception as e:
        return {"_err": str(e)[:120]}


def layer(url, n=2):
    m = j(url + "?f=json"); c = j(url + "/query?where=1%3D1&returnCountOnly=true&f=json")
    s = j(url + "/query?" + urllib.parse.urlencode({"where": "1=1", "outFields": "*", "returnGeometry": "false", "resultRecordCount": n, "f": "json"}))
    print("LAYER", url, "|", m.get("name"), m.get("geometryType"), "| count", c.get("count"), m.get("_err", ""))
    print("   fields:", [x["name"] for x in m.get("fields", []) or []][:30])
    print("   sample:", json.dumps([x.get("attributes") for x in s.get("features", [])])[:600])


def search(q, n=8, typ='type:"Feature Service"'):
    r = j("https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": f"{q} {typ}", "num": n, "f": "json", "sortField": "modified", "sortOrder": "desc"}))
    print("Q", q)
    for x in r.get("results", []):
        print("   ", x.get("owner"), "|", x.get("title"), "|", x.get("url"), "|", (x.get("modified") or 0) // 86400000)


for q in ["Baltimore 311 customer service requests 2026", "Baltimore 311 service requests", "Baltimore vacant building notices", "Baltimore residential permit parking",
          "Baltimore health clinics", "health center service delivery sites HRSA", "Head Start locations Maryland", "child care centers Maryland",
          "summer meals sites USDA", "Baltimore streetlight", "Baltimore compost drop off", "Baltimore playgrounds", "Baltimore splash pads", "Baltimore schools"]:
    search(q)
print("LEGISTAR", json.dumps(j("https://webapi.legistar.com/v1/baltimore/events?$top=3&$orderby=EventDate%20desc"))[:900])
print("BODIES", json.dumps(j("https://webapi.legistar.com/v1/baltimore/bodies?$top=5"))[:400])
