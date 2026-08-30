#!/usr/bin/env python3
"""check_versions.py — guard the version lockstep for every PWA in this repo.

Why this exists
---------------
Freshness in these apps comes from the service-worker lifecycle: the browser only
reinstalls a worker when `sw.js` changes byte-for-byte, so a deploy whose `VERSION`
constant was not bumped is *invisible to every existing installation, forever*. There is
no build step to do the bump automatically, and the version lives in three files per app,
so the failure is easy to make and silent when made.

This script makes it loud. Run it before every push:

    python3 tools/check_versions.py

It checks, per app:
  * sw.js `VERSION`, js/app.js `APP_VERSION` and the index.html version button all agree
  * the version parses as vYY.MM.DD (an optional trailing letter allows same-day rebuilds)
  * the version is not older than the newest mtime among that app's source files
    — i.e. you changed something and forgot to bump
  * the manifest still satisfies Chrome's "promotable" (installable) criteria
  * every URL the service worker precaches actually exists — `cache.addAll()` rejects
    on any 404, and a rejected install means the new version never activates

Exit code 0 = fine, 1 = something needs your attention.

To bump every app to today:  python3 tools/check_versions.py --bump
"""

from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APPS = ["sound-annoyer", "meditation-timer"]

VERSION_RE = re.compile(r"^v(\d{2})\.(\d{2})\.(\d{2})([a-z]?)$")

# (relative path, regex with one capture group for the version)
SITES = [
    ("sw.js",       re.compile(r"const VERSION\s*=\s*'([^']+)'")),
    ("js/app.js",   re.compile(r"const APP_VERSION\s*=\s*'([^']+)'")),
    ("index.html",  re.compile(r'class="version"[^>]*>(v[^<]+)<')),
]

# Files whose change should force a version bump.
WATCHED = ["sw.js", "js/app.js", "index.html", "css/styles.css", "manifest.json"]


def read_versions(app: pathlib.Path) -> dict[str, str | None]:
    found: dict[str, str | None] = {}
    for rel, pattern in SITES:
        path = app / rel
        if not path.exists():
            found[rel] = None
            continue
        m = pattern.search(path.read_text(encoding="utf-8"))
        found[rel] = m.group(1) if m else None
    return found


def version_date(version: str) -> dt.date | None:
    m = VERSION_RE.match(version)
    if not m:
        return None
    yy, mm, dd, _suffix = m.groups()
    try:
        return dt.date(2000 + int(yy), int(mm), int(dd))
    except ValueError:
        return None


def newest_source_mtime(app: pathlib.Path) -> float:
    stamps = [(app / rel).stat().st_mtime for rel in WATCHED if (app / rel).exists()]
    return max(stamps) if stamps else 0.0


def version_mtime(app: pathlib.Path) -> float:
    """When the version string itself was last written (sw.js is the source of truth)."""
    sw = app / "sw.js"
    return sw.stat().st_mtime if sw.exists() else 0.0


def next_version(current: str | None) -> str:
    """Today's date, with a letter suffix if that would collide with the current value.

    Same-day redeploys are the trap: `sw.js` must differ BYTE-FOR-BYTE or the browser
    never reinstalls it, so shipping twice in one day under the same vYY.MM.DD is
    invisible to every phone that already has the app. v26.08.30 -> v26.08.30a -> b -> …
    """
    today = f"v{dt.date.today():%y.%m.%d}"
    if current is None or not current.startswith(today):
        return today
    suffix = current[len(today):]
    if not suffix:
        return today + "a"
    if len(suffix) == 1 and "a" <= suffix < "z":
        return today + chr(ord(suffix) + 1)
    return today + "z"


def bump(app: pathlib.Path, new: str | None = None) -> None:
    if new is None:
        current = next(iter(set(read_versions(app).values())), None)
        new = next_version(current)
    for rel, pattern in SITES:
        path = app / rel
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        updated = pattern.sub(lambda m: m.group(0).replace(m.group(1), new), text, count=1)
        if updated != text:
            path.write_text(updated, encoding="utf-8", newline="\n")
    print(f"  bumped {app.name} -> {new}")


def check_manifest(app: pathlib.Path) -> list[str]:
    """Chrome's 'promotable' criteria — what decides whether an install is offered."""
    import json
    path = app / "manifest.json"
    if not path.exists():
        return ["manifest.json is missing"]
    try:
        m = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"manifest.json is not valid JSON: {exc}"]

    problems: list[str] = []
    if not (m.get("name") or m.get("short_name")):
        problems.append("manifest needs name or short_name")
    if not m.get("start_url"):
        problems.append("manifest needs start_url")
    display = m.get("display")
    override = m.get("display_override") or []
    if display in (None, "browser") and not [d for d in override if d != "browser"]:
        problems.append("display (or display_override) must not be 'browser'")
    if m.get("prefer_related_applications"):
        problems.append("prefer_related_applications:true suppresses the install prompt entirely")
    # id resolves against the ORIGIN, not the manifest path: './' would collide across apps.
    if "id" in m and not str(m["id"]).startswith("/"):
        problems.append(f"id {m['id']!r} should be an absolute path like '/{app.name}/'")

    icons = m.get("icons") or []
    any_icons = [i for i in icons if "any" in str(i.get("purpose", "any")).split()]
    if not any_icons:
        problems.append("no icon with purpose 'any' — Chrome will not offer to install")
    png = {i.get("sizes") for i in any_icons if i.get("type") == "image/png"}
    for want in ("192x192", "512x512"):
        if want not in png:
            problems.append(f"no {want} PNG icon with purpose 'any'")

    for icon in icons:
        src = icon.get("src", "")
        if src.startswith(("http://", "https://", "data:")):
            continue
        # Icon srcs carry a ?v= stamp so Chrome's WebAPK updater sees a changed URL and
        # re-mints the installed app; the query is not part of the filename on disk.
        path = src.split("?", 1)[0].split("#", 1)[0]
        if not (app / path.lstrip("./")).exists():
            problems.append(f"icon file not found: {src}")
    return problems


def check_precache(app: pathlib.Path) -> list[str]:
    """A single 404 in the precache list rejects cache.addAll() and fails the install."""
    sw = app / "sw.js"
    if not sw.exists():
        return ["sw.js is missing"]
    text = sw.read_text(encoding="utf-8")
    problems: list[str] = []
    # SHELL/PRECACHE are the critical lists (addAll); SOUNDS is best-effort, so only warn.
    for name, critical in (("SHELL", True), ("PRECACHE", True), ("SOUNDS", False)):
        m = re.search(rf"const {name} = \[(.*?)\];", text, re.S)
        if not m:
            continue
        for url in re.findall(r"'([^']+)'", m.group(1)):
            target = app / "index.html" if url == "./" else app / url.lstrip("./")
            if not target.exists():
                kind = "precache" if critical else "optional precache"
                problems.append(f"{kind} entry does not exist: {url}")
    return problems


def check(app_name: str) -> list[str]:
    app = ROOT / app_name
    problems: list[str] = []
    found = read_versions(app)

    missing = [rel for rel, v in found.items() if v is None]
    if missing:
        problems.append(f"could not find a version in: {', '.join(missing)}")
        return problems

    distinct = set(found.values())
    if len(distinct) != 1:
        detail = ", ".join(f"{rel}={v}" for rel, v in found.items())
        problems.append(f"versions disagree ({detail})")
        return problems

    version = next(iter(distinct))
    parsed = version_date(version)
    if parsed is None:
        problems.append(f"'{version}' is not vYY.MM.DD (optionally with a trailing letter)")
        return problems

    # Two independent staleness checks, because a date alone is not enough.
    newest = newest_source_mtime(app)
    if dt.date.fromtimestamp(newest) > parsed:
        problems.append(
            f"version is {version} ({parsed}) but source was last edited "
            f"{dt.date.fromtimestamp(newest)} — bump it, or the deploy never reaches "
            f"installed apps"
        )
    elif newest > version_mtime(app) + 1:
        # Same calendar day, but a source file was touched AFTER the version was last
        # written. The date has not changed, so sw.js may be byte-identical to what is
        # deployed — and a byte-identical worker is never reinstalled. This is the
        # second-deploy-in-one-day trap: it looks fine and ships to nobody.
        newer = sorted(
            rel for rel in WATCHED
            if (app / rel).exists() and (app / rel).stat().st_mtime > version_mtime(app) + 1
        )
        problems.append(
            f"{version} was written before the latest edit to {', '.join(newer)} — "
            f"a same-day redeploy needs a suffix ({next_version(version)}), or the "
            f"browser sees an unchanged sw.js and never reinstalls it"
        )

    if parsed > dt.date.today():
        problems.append(f"version {version} is dated in the future")

    problems += check_manifest(app)
    problems += check_precache(app)

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bump", action="store_true",
                        help="bump every app to today's date (adding a letter suffix if "
                             "it is already on today, so sw.js always changes)")
    args = parser.parse_args()

    if args.bump:
        print("Bumping:")
        for name in APPS:
            bump(ROOT / name)
        print("Re-run without --bump to verify.")
        return 0

    failed = False
    for name in APPS:
        problems = check(name)
        if problems:
            failed = True
            print(f"✗ {name}")
            for p in problems:
                print(f"    {p}")
        else:
            versions = read_versions(ROOT / name)
            print(f"✓ {name}  {next(iter(set(versions.values())))}")

    if failed:
        print("\nFix with: python3 tools/check_versions.py --bump")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
