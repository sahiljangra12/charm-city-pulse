"""One-time: freeze research inputs from Sahil's Baltimore Heat Atlas and Tree Cooling study
into pipeline/base/. refresh.py rebuilds the site from these plus live public APIs."""
import csv, json, sys, os
SRC = sys.argv[1]  # folder holding baltimore_heat_stress/ and baltimore_tree_cooling/
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "base")
H = os.path.join(SRC, "baltimore_heat_stress"); T = os.path.join(SRC, "baltimore_tree_cooling")
dash = json.load(open(os.path.join(H, "dashboard/data.json")))
rows = {r["GEOID"]: r for r in csv.DictReader(open(os.path.join(H, "data/processed/baltimore_heat_tracts.csv")))}

# geometry + identity
geo = {"type": "FeatureCollection", "features": []}
for f in dash["tracts"]["features"]:
    gid = f["properties"]["id"]; r = rows[gid]
    geo["features"].append({"type": "Feature", "properties": {"id": gid, "name": f["properties"]["name"],
        "csa": f["properties"]["csa"] or "", "aland_m2": float(r["aland_m2"] or 0)}, "geometry": f["geometry"]})
json.dump(geo, open(os.path.join(OUT, "tracts_geo.json"), "w"), separators=(",", ":"))

# full atlas table (environment, HVI, plus the ACS/PLACES/SVI vintage used by the atlas as fallback)
with open(os.path.join(H, "data/processed/baltimore_heat_tracts.csv")) as fi, open(os.path.join(OUT, "atlas_tracts.csv"), "w") as fo:
    fo.write(fi.read())

# TreeBaltimore plantings per CSA
plant = {}
for r in csv.DictReader(open(os.path.join(T, "data/processed/csa_panel.csv"))):
    plant[r["csa"]] = {"planted_2013_2020": int(float(r["planted_2013_2020"])), "area_km2": float(r["area_km2"])}
json.dump(plant, open(os.path.join(OUT, "tree_csa.json"), "w"), indent=1)

# research headline numbers
R = dash["R"]; tr = json.load(open(os.path.join(T, "outputs/results.json")))
m = tr["main_2022_25_vs_2006_09_per_tree"]["y15"]
json.dump({"heat": {k: R[k] for k in ["lst_range", "night_range", "veryhigh_n", "veryhigh_pop", "holc_lst_by_grade", "holc_tree_by_grade", "n_cooling_centers"]},
           "trees": {"per_tree_c": m["b"], "lo": m["lo"], "hi": m["hi"], "young_trees": tr["data"]["young_trees_le_1_5in"],
                     "vacant_sites": tr["data"]["vacant_street_sites"], "neighborhoods": tr["data"]["neighborhoods"], "scenes": tr["data"]["scenes_used"]}},
          open(os.path.join(OUT, "research.json"), "w"), indent=1)

# Cooling centres (2025 Code Red list as used in the Heat Atlas) with clearer names
LIB = "Enoch Pratt Free Library – {} Branch"
cool = []
for c in dash["cool"]:
    t = c["t"].strip(); n = c["n"]
    if t == "Library" or (not t and n == "Brooklyn"):
        t = "Library"; n = "Enoch Pratt Central Library" if n == "Central Library" else LIB.format(n)
    if t == "HABC": t = "Housing Authority site"
    hours = c["h"].replace("Normal business hours varies by site", "Regular library hours (vary by branch)")
    n = n.replace("Weinburg", "Weinberg").replace("Resilency", "Resiliency")
    cool.append({"name": n, "address": c["a"].strip(), "type": t, "hours": hours, "lat": c["y"], "lon": c["x"],
                 "seasonal": "Zion Lutheran" in n})
json.dump(cool, open(os.path.join(OUT, "cooling_2025.json"), "w"), indent=1)
print("base written:", os.listdir(OUT))
