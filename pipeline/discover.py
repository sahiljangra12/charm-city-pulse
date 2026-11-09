"""One-off discovery: finds public ArcGIS layers and outage feeds. Prints what it finds (run in GitHub Actions)."""
import json, urllib.request, urllib.parse, re
UA = {"User-Agent": "charm-city-pulse (github.com/sahiljangra12/charm-city-pulse)"}
def j(u, t=25):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return json.load(r)
    except Exception as e: return {"_err": str(e)[:150]}
def txt(u, t=25):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return r.read().decode("utf-8", "replace")
    except Exception as e: return "ERR " + str(e)[:150]
def layer(url):
    m = j(url + "?f=json"); f = [x["name"] for x in m.get("fields", [])][:40]
    s = j(url + "/query?" + urllib.parse.urlencode({"where": "1=1", "outFields": "*", "returnGeometry": "false", "resultRecordCount": 2, "f": "json"}))
    c = j(url + "/query?where=1%3D1&returnCountOnly=true&f=json")
    print("   LAYER", url, "|", m.get("name"), m.get("geometryType"), "| count", c.get("count"), "\n     fields:", f, "\n     sample:", json.dumps([x.get("attributes") for x in s.get("features", [])])[:700])
def walk(o, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, str) and re.search(r"/(FeatureServer|MapServer)(/\d+)?$", v): out.add(v)
            elif k in ("itemId", "portalItemId") and isinstance(v, str) and len(v) == 32: out.add("item:" + v)
            else: walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)
def item(i, depth=0):
    meta = j(f"https://www.arcgis.com/sharing/rest/content/items/{i}?f=json"); data = j(f"https://www.arcgis.com/sharing/rest/content/items/{i}/data?f=json")
    print("  " * depth + f"ITEM {i}: {meta.get('title')} [{meta.get('type')}] url={meta.get('url')}")
    out = set(); walk(data, out)
    if meta.get("url"): out.add(meta["url"])
    return out
print("=== Trash experience")
seen = set(); todo = list(item("065cf51484e045a09647a05299e4eb20"))
while todo:
    x = todo.pop()
    if x in seen: continue
    seen.add(x)
    if x.startswith("item:"):
        if len(seen) < 60: todo += list(item(x[5:], 1))
    elif re.search(r"rash|ecycl|Collect|Sweep|Snow|Bulk", x, re.I): print("  URL", x)
for u in [x for x in seen if not x.startswith("item:") and re.search(r"rash|ecycl|ollect|weep|now", x, re.I)][:6]:
    if re.search(r"/\d+$", u): layer(u)
    else:
        svc = j(u + "?f=json"); [layer(f"{u}/{l['id']}") for l in svc.get("layers", [])[:4]]
print("=== Search")
for q in ["Trash_Recycle_Day", "Baltimore snow emergency routes", "Baltimore street sweeping", "Baltimore wifi hotspots", "Baltimore libraries Enoch Pratt", "Baltimore community gardens", "Baltimore City Council districts 2024", "Baltimore bulk trash", "Baltimore cooling center hours", "Baltimore warming center"]:
    r = j("https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": q + ' type:"Feature Service"', "num": 6, "f": "json"}))
    print("Q", q); [print("   ", x.get("owner"), "|", x.get("title"), "|", x.get("url"), "|", (x.get("modified") or 0) // 1000) for x in r.get("results", [])]
print("=== BGE outage")
t = txt("https://outagemap.bge.com/"); print(t[:300].replace("\n", " "))
for m in set(re.findall(r"https?://[^\"' ]*kubra[^\"' ]*", t))[:10]: print("  ", m)
for u in ["https://kubra.io/stormcenter/api/v1/stormcenters/1ad4d9fe-0b0c-4c4b-9f1f-6f2e8f1d0f3a/views/x/currentState", "https://outagemap.bge.com/resources/data/external/interval_generation_data/metadata.json"]:
    print(u, txt(u)[:200])
