"""Opens a GitHub issue (which emails the repo owner) when the site's data pipeline has a problem, and closes it
once things are healthy again. Two modes:
  python pipeline/notify.py build   - after a build: reads step outcomes from env vars OUTCOME_<name>
  python pipeline/notify.py watch   - on a schedule: checks the LIVE site for stale data
Needs GH_TOKEN (the workflow's GITHUB_TOKEN with issues: write) and GITHUB_REPOSITORY."""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timezone

REPO = os.environ.get("GITHUB_REPOSITORY", "sahiljangra12/charm-city-pulse")
OWNER = REPO.split("/")[0]
SITE = os.environ.get("SITE_URL", f"https://{OWNER}.github.io/{REPO.split('/')[1]}/")
RUN = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{REPO}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
NAMES = {"refresh": "Neighborhood data (Census, CDC, city map layers)", "extras": "Food help, harbor water, trends, bus schedules",
         "alerts": "Code Blue / Code Red and water notices", "photos": "Photos", "city": "City services (trash, snow routes, Wi-Fi, libraries)",
         "tests": "Automatic page tests", "publish": "Publishing the website", "commit": "Saving the new data"}


def gh(*args):
    r = subprocess.run(["gh", *args, "-R", REPO], capture_output=True, text=True)
    if r.returncode: print("gh:", r.stderr.strip()[:300])
    return r.stdout


def issue(label, title, problems):
    gh("label", "create", label, "--color", "d73a4a", "--description", "Automatic alert from the data pipeline", "--force")
    open_ = json.loads(gh("issue", "list", "--label", label, "--state", "open", "--json", "number") or "[]")
    if problems:
        body = "\n".join(f"- {p}" for p in problems) + f"\n\nDetails: {RUN}\n\nThe live site keeps showing the last good version until this is fixed. This issue closes itself when the next run is healthy."
        if open_: gh("issue", "comment", str(open_[0]["number"]), "--body", "Still happening:\n" + body)
        else: gh("issue", "create", "--title", title, "--label", label, "--body", f"@{OWNER} the site needs a look.\n\n" + body)
        print("[notify] reported:", problems)
    else:
        for i in open_: gh("issue", "close", str(i["number"]), "--comment", f"Healthy again as of {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC. {RUN}")
        print("[notify] healthy")


def age_h(iso):
    return (datetime.now(timezone.utc) - datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds() / 3600


def get(path):
    with urllib.request.urlopen(SITE + path + f"?t={int(datetime.now().timestamp())}", timeout=30) as r: return json.load(r)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "build"
    if mode == "build":
        bad = [f"{NAMES.get(k[8:].lower(), k[8:])} failed" for k, v in os.environ.items() if k.startswith("OUTCOME_") and v == "failure"]
        issue("site-health", "Daily build had a problem", bad)
        return
    problems = []
    try:
        m = get("data/meta.json"); h = age_h(m["built"])
        if h > 36: problems.append(f"Neighborhood data is {h / 24:.1f} days old (it should rebuild every morning)")
        if m.get("skipped_hosts"): problems.append("These servers did not answer in the last build, so older copies were kept: " + ", ".join(m["skipped_hosts"]))
    except Exception as e: problems.append(f"Could not read the live site's build record: {e}")
    try:
        s = get("data/sensors.json"); h = age_h(s["updated"])
        if h > 4: problems.append(f"The hourly Code Blue/Red check last ran {h:.0f} hours ago")
    except Exception as e: problems.append(f"Could not read the hourly check: {e}")
    try:
        hl = get("data/health.json")
        problems += [f"{NAMES.get(k, k)} failed in the last build" for k, v in hl.get("steps", {}).items() if v == "failure"]
    except Exception: pass
    issue("data-stale", "Site data is out of date", problems)


if __name__ == "__main__":
    main()
