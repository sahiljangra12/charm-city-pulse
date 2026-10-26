"""Download the site's background photos from Wikimedia Commons (freely licensed, credited on the Sources page).
Saves site/img/<key>.jpg (2400px wide) and <key>-m.jpg (1100px) once; later runs skip files that already exist."""
import json, os, sys, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "site", "img")
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}

def thumb(title, width):
    q = urllib.parse.urlencode({"action": "query", "titles": "File:" + title, "prop": "imageinfo", "iiprop": "url", "iiurlwidth": width, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + q, headers=UA), timeout=30) as r:
        page = next(iter(json.load(r)["query"]["pages"].values()))
    return page["imageinfo"][0]["thumburl"]

def main():
    ok = True
    for c in json.load(open(os.path.join(IMG, "credits.json"))):
        for suffix, width in (("", 2400), ("-m", 1100)):
            out = os.path.join(IMG, f"{c['key']}{suffix}.jpg")
            if os.path.exists(out) and os.path.getsize(out) > 20000:
                continue
            try:
                url = thumb(c["title"], width)
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                    data = r.read()
                open(out, "wb").write(data)
                print(f"saved {os.path.basename(out)} ({len(data)//1024} KB)")
            except Exception as e:
                ok = False
                print(f"could not fetch {c['key']}{suffix}: {e}", file=sys.stderr)
    return 0 if ok else 0  # never fail the build over a photo; the page falls back to a gradient

if __name__ == "__main__":
    sys.exit(main())
