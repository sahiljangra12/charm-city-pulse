"""Code Blue (extreme cold) and Code Red (extreme heat) status from the Baltimore City Health Department,
water notices from the Department of Public Works, and (with a free OpenAQ key) neighborhood air sensors.

The Health Department announces each alert as a news post. This reads the newest posts, keeps the
Code Blue / Code Red ones, works out the last day each covers from its text, and writes
site/data/city_alerts.json. Runs hourly in GitHub Actions. Standard library only.
If the city site can't be reached, the previous file is left untouched.
"""
import html, json, os, re, sys, urllib.request
from datetime import date, datetime, timedelta, timezone

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site", "data", "city_alerts.json")
SRC = "https://www.baltimorecity.gov/health/news-media"
UA = {"User-Agent": "CharmCityPulse/1.0 (https://github.com/sahiljangra12/charm-city-pulse)"}
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], 1)}
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
ROW = re.compile(r'<div class="views-row">(.*?)</a>\s*</div>', re.S)


def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def kind_of(t):
    t = t.lower()
    if "code blue" in t or "extreme cold" in t: return "blue"
    if "code red" in t or "extreme heat" in t: return "red"
    return None


def last_day(words, posted):
    """Latest date the announcement mentions; else the weekday after 'through'; else the day after posting."""
    ds = []
    for m, d, y in re.findall(r"\b(" + "|".join(MONTHS) + r")\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?", words.lower()):
        yr = int(y) if y else posted.year
        try:
            dt = date(yr, MONTHS[m], int(d))
        except ValueError:
            continue
        if not y and dt < posted - timedelta(days=60): dt = date(yr + 1, dt.month, dt.day)   # "through January 3" posted in late December
        ds.append(dt)
    if ds: return max(ds)
    w = re.search(r"through (" + "|".join(DAYS) + ")", words.lower())
    if w:
        k = (DAYS.index(w.group(1)) - posted.weekday()) % 7
        return posted + timedelta(days=k or 7)
    return posted + timedelta(days=1)


def parse(page, today):
    alerts = []
    for row in ROW.findall(page):
        href = re.search(r'href="([^"]+)"', row); title = re.search(r'<h2[^>]*>(.*?)</h2>', row, re.S)
        lede = re.search(r'article_card__lede">(.*?)</div>', row, re.S); posted = re.search(r'<time datetime="(\d{4}-\d{2}-\d{2})', row)
        if not (href and title and posted): continue
        t, l = text(title.group(1)), text(lede.group(1)) if lede else ""
        k = kind_of(t)
        if not k or re.search(r"\b(lift|end|expire|cancel)", t.lower()): continue
        p = date.fromisoformat(posted.group(1)); until = last_day(t + " " + l, p)
        url = href.group(1) if href.group(1).startswith("http") else "https://www.baltimorecity.gov" + href.group(1)
        alerts.append({"kind": k, "title": t, "summary": l[:300], "url": url, "posted": p.isoformat(), "until": until.isoformat(),
                       "active": p - timedelta(days=1) <= today <= until})
    return alerts


DPW = "https://www.baltimorecity.gov/publicworks/news-and-media"
WATER_KINDS = [("boil", r"boil[- ]water"), ("main", r"water main|main break"), ("outage", r"water (outage|service interruption|shut[- ]?off)|no water|low (water )?pressure"),
               ("supply", r"drought|water (restriction|conservation|supply)|susquehanna|conserve water")]


def water_notices(page, today):
    """Recent Department of Public Works water notices. A boil-water advisory stays up until a post says it was lifted."""
    out, lifted = [], set()
    for row in ROW.findall(page):
        href = re.search(r'href="([^"]+)"', row); title = re.search(r'<h2[^>]*>(.*?)</h2>', row, re.S)
        lede = re.search(r'article_card__lede">(.*?)</div>', row, re.S); posted = re.search(r'<time datetime="(\d{4}-\d{2}-\d{2})', row)
        if not (href and title and posted): continue
        t, l = text(title.group(1)), text(lede.group(1)) if lede else ""
        kind = next((k for k, rx in WATER_KINDS if re.search(rx, (t + " " + l).lower())), None)
        if not kind: continue
        p = date.fromisoformat(posted.group(1))
        if kind == "boil" and re.search(r"\b(lift|rescind|end|cancel)", t.lower()): lifted.add(p); continue
        url = href.group(1) if href.group(1).startswith("http") else "https://www.baltimorecity.gov" + href.group(1)
        keep = (today - p).days <= (14 if kind == "boil" else 10)
        if keep: out.append({"kind": kind, "title": t, "summary": l[:300], "url": url, "posted": p.isoformat()})
    return [n for n in out if not (n["kind"] == "boil" and any(d >= date.fromisoformat(n["posted"]) for d in lifted))]


# ---------- low-cost air sensors (OpenAQ). Needs a free OpenAQ key in the OPENAQ_API_KEY secret; skipped without one.
SENSORS_OUT = os.path.join(os.path.dirname(OUT), "sensors.json")
def sensors():
    key = os.environ.get("OPENAQ_API_KEY", "").strip()
    if not key: print("[city-alerts] OPENAQ_API_KEY not set; neighborhood air sensors skipped"); return
    H = {**UA, "X-API-Key": key}
    def j(url):
        with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=30) as r: return json.load(r)
    locs = j("https://api.openaq.org/v3/locations?bbox=-76.712,39.197,-76.529,39.372&parameters_id=2&limit=100").get("results", [])
    now = datetime.now(timezone.utc); out = []
    for L in locs:
        if L.get("isMonitor"): continue                          # official monitors already come from EPA AirNow
        pm = {s["id"] for s in L.get("sensors", []) if (s.get("parameter") or {}).get("name") == "pm25"}
        if not pm: continue
        try: latest = j(f"https://api.openaq.org/v3/locations/{L['id']}/latest").get("results", [])
        except Exception as e: print("[city-alerts] sensor", L["id"], e); continue
        for r in latest:
            if r.get("sensorsId") not in pm or r.get("value") is None: continue
            t = datetime.fromisoformat(r["datetime"]["utc"].replace("Z", "+00:00"))
            if now - t > timedelta(hours=3) or not (0 <= r["value"] < 1000): continue
            c = L.get("coordinates") or {}
            out.append({"name": L.get("name") or "Sensor", "provider": (L.get("provider") or {}).get("name"), "pm25": round(r["value"], 1),
                        "time": r["datetime"]["utc"], "lat": round(c.get("latitude"), 5), "lon": round(c.get("longitude"), 5)})
            break
    json.dump({"source": "OpenAQ (low-cost sensors)", "updated": now.isoformat(timespec="minutes"), "sensors": out}, open(SENSORS_OUT, "w"), indent=1)
    print(f"[city-alerts] {len(out)} neighborhood air sensors reporting")


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: return r.read().decode("utf-8", "replace")


def main():
    today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=-5))).date()   # Baltimore standard time; a day's slack covers DST
    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    out = dict(old)
    try:
        page = fetch(SRC)
        if "views-row" not in page: raise RuntimeError("page layout changed")
        alerts = parse(page, today)
        out.update({"source": SRC, "active": [a for a in alerts if a["active"]], "last": {k: next((a for a in alerts if a["kind"] == k), None) for k in ("blue", "red")}})
    except Exception as e:
        print("[city-alerts] Health Department:", e, "- keeping the previous status")
    try:
        page = fetch(DPW)
        if "views-row" not in page: raise RuntimeError("page layout changed")
        out["water"] = water_notices(page, today); out["water_source"] = DPW
    except Exception as e:
        print("[city-alerts] Public Works:", e, "- keeping the previous water notices")
    if old != out:
        json.dump(out, open(OUT, "w"), indent=1)
        print("[city-alerts] updated:", [a["title"] for a in out.get("active", [])] or "no Code Blue/Red", "| water:", [w["title"] for w in out.get("water", [])] or "none")
    else:
        print("[city-alerts] unchanged")
    try: sensors()
    except Exception as e: print("[city-alerts] sensors:", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
