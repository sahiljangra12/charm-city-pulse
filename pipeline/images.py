"""Download the site's background photos from Wikimedia Commons (freely licensed, credited on the Sources page)
and prepare them for every screen.

For each photo in site/img/credits.json this takes the largest original Commons offers, up to 3840 px wide (4K),
gives it a gentle enhancement (contrast, colour, sharpening) and saves three sizes from that one master:
  <key>-4k.jpg  up to 3840 px  for 4K and high-density laptop screens
  <key>.jpg     2000 px        for ordinary laptops and desktops
  <key>-m.jpg   1100 px        for phones
A photo is only as sharp as its original: one smaller than 3840 px is saved at its own size, never stretched.
Runs once per photo; site/img/enhanced.json records what has been done. Also fetches the Baltimore flag.
"""
import io, json, os, sys, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "site", "img")
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}
VERSION = 2
SIZES = (("-4k", 3840, 80), ("", 2000, 82), ("-m", 1100, 80))   # suffix, max width, JPEG quality


def info(title, width):
    q = urllib.parse.urlencode({"action": "query", "titles": "File:" + title, "prop": "imageinfo", "iiprop": "url|size", "iiurlwidth": width, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + q, headers=UA), timeout=30) as r:
        return next(iter(json.load(r)["query"]["pages"].values()))["imageinfo"][0]


def get(url, timeout=120):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def enhance(im):
    from PIL import ImageEnhance, ImageFilter, ImageOps
    im = ImageOps.exif_transpose(im).convert("RGB")
    im = ImageOps.autocontrast(im, cutoff=0.3)                    # trims a hazy, washed-out range
    im = ImageEnhance.Contrast(im).enhance(1.05)
    im = ImageEnhance.Color(im).enhance(1.08)                     # a little more colour, not oversaturated
    return im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))


def save_sizes(key, master):
    from PIL import Image, ImageFilter
    out = {}
    for suffix, width, q in SIZES:
        im = master if master.width <= width else master.resize((width, round(master.height * width / master.width)), Image.LANCZOS)
        if im is not master: im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=35, threshold=2))   # restore crispness lost in downscaling
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        open(os.path.join(IMG, f"{key}{suffix}.jpg"), "wb").write(buf.getvalue())
        out[suffix or "full"] = [im.width, im.height, len(buf.getvalue()) // 1024]
    return out


def flag():
    p = os.path.join(IMG, "baltimore-flag.png")
    if os.path.exists(p) and os.path.getsize(p) > 2000: return
    try:
        data = get(info("Flag of Baltimore, Maryland.svg", 480)["thumburl"], 60)
        open(p, "wb").write(data); print(f"saved baltimore-flag.png ({len(data)//1024} KB)")
    except Exception as e:
        print(f"could not fetch the flag: {e}", file=sys.stderr)


def main():
    try:
        from PIL import Image
    except ImportError:
        print("Pillow is not installed; skipping photo enhancement", file=sys.stderr); flag(); return 0
    rec_p = os.path.join(IMG, "enhanced.json")
    rec = json.load(open(rec_p)) if os.path.exists(rec_p) else {}
    for c in json.load(open(os.path.join(IMG, "credits.json"))):
        k = c["key"]
        if rec.get(k, {}).get("v") == VERSION and all(os.path.exists(os.path.join(IMG, f"{k}{s}.jpg")) for s, _, _ in SIZES):
            continue
        try:
            ii = info(c["title"], 3840)
            src = ii["thumburl"] if ii.get("width", 0) > 3840 else ii["url"]      # never ask Commons to upscale
            master = enhance(Image.open(io.BytesIO(get(src))))
            if master.width > 3840: master = master.resize((3840, round(master.height * 3840 / master.width)), Image.LANCZOS)
            sizes = save_sizes(k, master)
            rec[k] = {"v": VERSION, "original": [ii.get("width"), ii.get("height")], "sizes": sizes}
            print(f"{k}: original {ii.get('width')}x{ii.get('height')} -> " + ", ".join(f"{n} {w}px {kb} KB" for n, (w, h, kb) in sizes.items()))
        except Exception as e:
            print(f"could not prepare {k}: {e}", file=sys.stderr)   # the previous files stay in place
    json.dump(rec, open(rec_p, "w"), indent=1)
    flag()
    return 0   # never fail the build over a photo


if __name__ == "__main__":
    sys.exit(main())
