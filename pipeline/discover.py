"""One-off probe: fields of the new Recreation & Parks layers."""
import json, urllib.request


def j(u, t=30):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=t) as r:
            return json.load(r)
    except Exception as e:
        return {"_err": str(e)[:120]}


A = "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services"
for svc in ["bcrpParks2023", "recreationCenter2023", "pool2023"]:
    s = j(f"{A}/{svc}/FeatureServer?f=json")
    for L in s.get("layers", []):
        u = f"{A}/{svc}/FeatureServer/{L['id']}"
        f = j(u + "?f=json"); c = j(u + "/query?where=1%3D1&returnCountOnly=true&f=json")
        smp = j(u + "/query?where=1%3D1&outFields=*&returnGeometry=false&resultRecordCount=2&f=json")
        print("LAYER", u, "|", L["name"], f.get("geometryType"), "| count", c.get("count"))
        print("   fields:", [x["name"] for x in f.get("fields", [])][:25])
        print("   sample:", json.dumps([x.get("attributes") for x in smp.get("features", [])])[:500])
