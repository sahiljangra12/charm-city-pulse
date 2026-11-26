"""One-off probe, round 2: fields of the new sources."""
import json, urllib.request, urllib.parse


def j(u, t=40):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=t) as r:
            return json.load(r)
    except Exception as e:
        return {"_err": str(e)[:120]}


def layer(url, where="1=1", n=2, extra=None):
    m = j(url + "?f=json"); c = j(url + "/query?" + urllib.parse.urlencode({"where": where, "returnCountOnly": "true", "f": "json"}))
    s = j(url + "/query?" + urllib.parse.urlencode({"where": where, "outFields": "*", "returnGeometry": "false", "resultRecordCount": n, "f": "json", "orderByFields": extra or ""}))
    print("LAYER", url, "|", m.get("name"), m.get("geometryType"), "| count", c.get("count"), m.get("_err", ""), c.get("_err", ""))
    print("   fields:", [x["name"] for x in m.get("fields", []) or []][:40])
    print("   sample:", json.dumps([x.get("attributes") for x in s.get("features", [])])[:900])


def distinct(url, field, where="1=1"):
    d = j(url + "/query?" + urllib.parse.urlencode({"where": where, "outFields": field, "returnDistinctValues": "true", "returnGeometry": "false", "f": "json"}))
    print("   DISTINCT", field, sorted({str(x["attributes"].get(field)) for x in d.get("features", [])})[:120])


A = "https://services1.arcgis.com/UWYHeuuJISiGmgXx/arcgis/rest/services"
u = A + "/311_Customer_Service_Requests_current/FeatureServer"
s = j(u + "?f=json"); print("311 layers", [(l["id"], l["name"]) for l in s.get("layers", [])])
L311 = u + "/0"; layer(L311)
distinct(L311, "SRType", "CreatedDate > CURRENT_TIMESTAMP - 30")
distinct(L311, "SRStatus")
layer("https://baltegis.baltimorecity.gov/mapping/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer/1")
s = j("https://baltegis.baltimorecity.gov/mapping/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer?f=json"); print("DHCD layers", [(l["id"], l["name"]) for l in s.get("layers", [])])
layer(A + "/Residential_Parking_Permits/FeatureServer/0")
layer("https://gisportal.hrsa.gov/server/rest/services/HealthCareFacilities/HealthCareFacilities/MapServer/18", "SITE_CITY='Baltimore'", 3)
layer("https://services.arcgis.com/njFNhDsUCentVYJW/arcgis/rest/services/MD_Summer_Meals_Program_Sites_2026/FeatureServer/0", "1=1", 2)
layer(A + "/BCRP_Asset_Inventory_view/FeatureServer/0")
distinct(A + "/BCRP_Asset_Inventory_view/FeatureServer/0", "assetType")
layer(A + "/BCPSS_Schools_2025/FeatureServer/0")
e = j("https://webapi.legistar.com/v1/baltimore/events?$top=2&$orderby=EventDate%20desc")
print("EVENT keys", list(e[0].keys()) if isinstance(e, list) and e else e)
print("EVENT", json.dumps(e[:2] if isinstance(e, list) else e)[:1200])
