"""One-off probe: where did the Recreation & Parks layers move?"""
import json, urllib.request, urllib.parse, re


def j(u, t=30):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=t) as r:
            return json.load(r)
    except Exception as e:
        return {"_err": str(e)[:120]}


print("geodata:", j("https://geodata.baltimorecity.gov/egis/rest/services/CityView/BCRPServices/FeatureServer?f=json", 25).get("_err", "OK"))
B = "https://baltegis.baltimorecity.gov"
for folder in ["/server/rest/services/CityView", "/Legacy/rest/services/CityView", "/mapping/rest/services/CityView"]:
    d = j(B + folder + "?f=json")
    names = [s["name"].split("/")[-1] + ":" + s["type"] for s in d.get("services", [])]
    print("FOLDER", folder, [n for n in names if re.search(r"BCRP|Park|Pool|Rec", n, re.I)], d.get("_err", ""))
    for n in names:
        if re.search(r"BCRP|Park|Pool|Rec", n, re.I):
            nm, typ = n.split(":")
            s = j(f"{B}{folder}/{nm}/{typ}?f=json")
            for L in s.get("layers", []):
                url = f"{B}{folder}/{nm}/{typ}/{L['id']}"
                c = j(url + "/query?where=1%3D1&returnCountOnly=true&f=json")
                f = j(url + "?f=json")
                print("   ", url, "|", L["name"], "| count", c.get("count"), "|", [x["name"] for x in f.get("fields", [])][:12])
for q in ["Baltimore parks BCRP", "Baltimore recreation centers", "Baltimore swimming pools"]:
    r = j("https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": q + ' type:"Feature Service"', "num": 8, "f": "json"}))
    print("Q", q)
    for x in r.get("results", []):
        if re.search("balt", str(x.get("owner")) + str(x.get("url")), re.I):
            print("   ", x.get("owner"), "|", x.get("title"), "|", x.get("url"))
