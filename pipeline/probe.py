"""Check every browser-side endpoint the app calls: HTTP status, CORS header, and a peek at the payload."""
import json, sys, urllib.request
ORIGIN = "https://sahiljangra12.github.io"
P = [
 ("open-meteo forecast", "https://api.open-meteo.com/v1/forecast?latitude=39.29&longitude=-76.61&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit"),
 ("open-meteo air", "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.29&longitude=-76.61&current=us_aqi,pm2_5"),
 ("nws alerts", "https://api.weather.gov/alerts/active?point=39.29,-76.61"),
 ("usgs v1 latest", "https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items?f=json&bbox=-76.76,39.17,-76.50,39.42&parameter_code=00060,00065,00010&limit=500"),
 ("usgs v1 locations", "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations/items?f=json&bbox=-76.76,39.17,-76.50,39.42&limit=5"),
 ("fema nfhl layers", "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/layers?f=json"),
 ("fema query", "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=-76.585,39.272&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&returnGeometry=false&f=json"),
 ("airnow layer", "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Air_Now_Monitor_Data_Public/FeatureServer/0?f=json"),
 ("airnow query", "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Air_Now_Monitor_Data_Public/FeatureServer/0/query?where=1%3D1&geometry=-76.95,39.05,-76.30,39.60&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&outFields=*&resultRecordCount=5&f=json"),
 ("esri suggest", "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?f=json&text=3400%20N%20Charles&searchExtent=-76.72,39.19,-76.52,39.38&maxSuggestions=5"),
 ("esri find", "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=3400%20N%20Charles%20St%2C%20Baltimore%2C%20MD&maxLocations=1&outFields=Match_addr"),
 ("city geocoder list", "https://geodata.baltimorecity.gov/egis/rest/services/Locator?f=json"),
 ("photon", "https://photon.komoot.io/api/?q=3400%20N%20Charles%20St%20Baltimore&limit=3&bbox=-76.72,39.19,-76.52,39.38"),
 ("nominatim", "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=3400%20N%20Charles%20St%2C%20Baltimore"),
 ("overpass", "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bnode%5Bamenity%3Ddrinking_water%5D(39.28,-76.62,39.30,-76.60)%3Bout%201%3B"),
 ("carto tile", "https://a.basemaps.cartocdn.com/light_all/12/1170/1563.png"),
 ("city cooling hub", "https://data.baltimorecity.gov/api/search/v1/collections/all/items?limit=5&q=cooling%20center"),
]
for name, url in P:
    try:
        req = urllib.request.Request(url, headers={"Origin": ORIGIN, "User-Agent": "CharmCityPulse-probe/1.0", "Accept": "application/json, application/geo+json, */*"})
        with urllib.request.urlopen(req, timeout=40) as r:
            body = r.read(); acao = r.headers.get("Access-Control-Allow-Origin")
            print(f"## {name}: {r.status} CORS={acao} bytes={len(body)}")
            try:
                j = json.loads(body)
                if name == "fema nfhl layers": print("   ", [(l['id'], l['name']) for l in j.get('layers', []) if 'Flood' in l['name']])
                elif name == "airnow layer": print("   fields:", [f['name'] for f in j.get('fields', [])])
                elif name == "airnow query": print("   ", json.dumps(j.get('features', [])[:2])[:900])
                elif name.startswith("usgs"): print("   ", json.dumps(j.get('features', [])[:1])[:700], "n=", len(j.get('features', [])))
                elif name == "city geocoder list": print("   ", j.get("services"))
                else: print("   ", json.dumps(j)[:500])
            except Exception: print("    (non-JSON)", body[:80])
    except Exception as e:
        print(f"## {name}: FAILED {e}")
