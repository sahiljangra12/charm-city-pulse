"""Code Blue (extreme cold) and Code Red (extreme heat) status from the Baltimore City Health Department.

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


def main():
    today = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=-5))).date()   # Baltimore standard time; a day's slack covers DST
    try:
        req = urllib.request.Request(SRC, headers=UA)
        with urllib.request.urlopen(req, timeout=40) as r: page = r.read().decode("utf-8", "replace")
    except Exception as e:
        print("[city-alerts] could not reach the Health Department site:", e); return 0
    alerts = parse(page, today)
    if "views-row" not in page:
        print("[city-alerts] page layout changed; keeping the previous file"); return 0
    out = {"source": SRC, "active": [a for a in alerts if a["active"]], "last": {k: next((a for a in alerts if a["kind"] == k), None) for k in ("blue", "red")}}
    old = json.load(open(OUT)) if os.path.exists(OUT) else None
    if old != out:
        json.dump(out, open(OUT, "w"), indent=1); print("[city-alerts] updated:", [a["title"] for a in out["active"]] or "none active")
    else:
        print("[city-alerts] unchanged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
