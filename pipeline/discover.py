"""One-off discovery, round 4."""
import json, urllib.request, re
def get(u, h=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=h or {"User-Agent": "Mozilla/5.0"}), timeout=30) as r: return r.read().decode("utf-8", "replace")
    except Exception as e: return "ERR " + str(e)[:150]
for wm in ["18f22441d7de423c874caa14d7442a5a", "ced53729fcaa454581f12d4864400e8c"]:
    d = json.loads(get(f"https://www.arcgis.com/sharing/rest/content/items/{wm}/data?f=json"))
    for L in d.get("operationalLayers", []):
        fc = L.get("featureCollection") or {}
        ls = fc.get("layers", [])
        info = [(x.get("layerDefinition", {}).get("geometryType"), len(x.get("featureSet", {}).get("features", [])), [f["name"] for f in x.get("layerDefinition", {}).get("fields", [])][:12]) for x in ls]
        print("WM", wm, "|", L.get("title"), "| keys", list(L.keys())[:12], "| fc", info)
        for x in ls[:1]:
            fs = x.get("featureSet", {}).get("features", [])
            if fs: print("   attrs:", json.dumps([f.get("attributes") for f in fs[:3]])[:600], "| sr", x.get("featureSet", {}).get("spatialReference") or x.get("layerDefinition", {}).get("extent", {}).get("spatialReference"))
print("BGE default.html:\n", get("https://outagemap.bge.com/default.html"))
for u in ["https://outagemap.bge.com/", "https://www.bge.com/outages/outage-map"]:
    print("BGE", u, get(u)[:1500])
