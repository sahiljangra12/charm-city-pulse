"""One-off probe, round 4: run life.py and summarize what it wrote."""
import json, os, subprocess, sys
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "life.py")])
d = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site", "data", "life.json")))
print("ERRORS", d.get("errors"))
for k, v in d.items():
    if isinstance(v, list): print("PART", k, len(v), json.dumps(v[:2])[:600])
print("FIX", d.get("fix", {}).get("since"), json.dumps(sorted(d.get("fix", {}).get("types", {}).items(), key=lambda x: -x[1]["n"])[:60])[:5000])
print("HOMES", json.dumps(d.get("homes"))[:600])
ph = d.get("pharmacies", []); print("PHARM with hours", sum(1 for p in ph if p.get("hours")), "of", len(ph), [p["hours"] for p in ph if p.get("hours")][:40])
print("SCHOOL types", sorted({s.get("type") for s in d.get("schools", [])}, key=str))
