#!/usr/bin/env python3
"""Recruiter outreach MCP server (stdio, Python standard library only).

Gives Claude the tools it needs to personalise recruiter outreach:
  * your candidate profile / Claude instructions (a local Markdown file)
  * open roles pulled from public ATS job boards (Greenhouse, Lever, Ashby),
    plus "manual check" search links for firms without a public board
  * discovery of new firms per lane and region, added as pending until approved
  * LinkedIn / Google search links to find the recruiters for a company
  * LinkedIn message length limits
  * a local CSV tracker so nobody is contacted twice

It never logs in to LinkedIn and never sends anything: LinkedIn does not offer
an API for this and automating the website breaks its User Agreement. Claude
drafts, you review and send.

Personal data (profile, tracker, your company list) lives in
~/.linkedin-outreach (or OUTREACH_HOME) and is never written inside the repo.
"""

import csv
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SERVER_NAME = "recruiter-outreach"
SERVER_VERSION = "0.2.0"
DEFAULT_PROTOCOL = "2025-06-18"

HERE = Path(__file__).resolve().parent
HOME = Path(os.path.expanduser(os.environ.get("OUTREACH_HOME") or "~/.linkedin-outreach"))
PROFILE_PATH = HOME / "profile.md"
COMPANIES_PATH = HOME / "companies.json"
TRACKER_PATH = HOME / "outreach_log.csv"
LOCAL_SEED_PATH = HOME / "tracker_seed.json"
SEED_MARKER_PATH = HOME / ".tracker_seeded"
DEFAULT_COMPANIES_PATH = HERE / "companies.json"
CANDIDATES_PATH = HERE / "firm_candidates.json"
BUNDLED_SEED_PATH = HERE / "tracker_seed.json"
PROFILE_TEMPLATE_PATH = HERE.parent / "templates" / "profile.template.md"

HTTP_TIMEOUT = 15
PROBE_TIMEOUT = 8
USER_AGENT = "recruiter-outreach-mcp/0.2 (+personal job search)"

# Character limits LinkedIn enforces (as of 2026). Free accounts get a shorter
# connection note than Premium.
MESSAGE_LIMITS = {
    "connection_note": 300,
    "connection_note_free": 200,
    "inmail_subject": 200,
    "inmail_body": 1900,
    "message": 8000,
}
# Lengths to aim for; the hard limits above still apply.
MESSAGE_TARGETS = {"inmail_body": 700}

# Sponsorship never goes in a connection note.
VISA_PATTERN = re.compile(
    r"\b(visas?|sponsor(ship|ed|ing)?|work permits?|work authori[sz]ation|LMIA|H-?1B|PGWP|iqama)\b", re.I
)

TRACKER_FIELDS = [
    "date", "company", "recruiter_name", "recruiter_url", "role_title",
    "role_url", "channel", "status", "message", "notes",
]


# --------------------------------------------------------------------------
# Data files
# --------------------------------------------------------------------------

def _repo_root():
    for p in (HERE, *HERE.parents):
        if (p / ".git").exists():
            return p
    return None


def _data_dir():
    """Create and return the personal data directory, refusing any path inside the repo."""
    home = HOME.resolve()
    root = _repo_root()
    if root is not None and root != Path.home().resolve() and (home == root or root in home.parents):
        raise RuntimeError(
            f"OUTREACH_HOME points inside the repository ({home}). Personal data must live "
            "outside it: unset OUTREACH_HOME or point it elsewhere."
        )
    home.mkdir(parents=True, exist_ok=True)
    return home


def _read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_company_file():
    path = COMPANIES_PATH if COMPANIES_PATH.exists() else DEFAULT_COMPANIES_PATH
    data = _read_json(path)
    if path != DEFAULT_COMPANIES_PATH and not (data.get("regions") and data.get("lanes")):
        default = _read_json(DEFAULT_COMPANIES_PATH)
        data["regions"] = data.get("regions") or default["regions"]
        data["lanes"] = data.get("lanes") or default["lanes"]
    return data


def save_company_file(data):
    _data_dir()
    tmp = COMPANIES_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(COMPANIES_PATH)


def load_companies():
    return load_company_file()["companies"]


def load_regions():
    return load_company_file()["regions"]


def _firm_status(company):
    return company.get("status", "approved")


def _read_profile():
    return PROFILE_PATH.read_text(encoding="utf-8") if PROFILE_PATH.exists() else ""


def work_eligibility(profile_text=None, regions=None):
    """Region key -> True (can work there), False (needs sponsorship) or None (not stated).

    Read from lines like "- canada: yes" in the profile's "Work eligibility by region" section.
    """
    text = _read_profile() if profile_text is None else profile_text
    result = {}
    for key in regions if regions is not None else load_regions():
        result[key] = None
        m = re.search(rf"^\s*[-*]\s*{re.escape(key)}\s*:\s*(.*)$", text, re.I | re.M)
        if not m:
            continue
        value = m.group(1).strip().lower()
        if re.match(r"(yes|y|true|eligible)\b", value):
            result[key] = True
        elif re.match(r"(no|n|false|not eligible|needs? sponsorship)\b", value):
            result[key] = False
    return result


def _eligibility_for(region_keys, eligibility):
    values = [eligibility.get(k) for k in region_keys]
    if any(v is True for v in values):
        return True
    if values and all(v is False for v in values):
        return False
    return None


def get_candidate_profile(_args):
    if not PROFILE_PATH.exists():
        template = PROFILE_TEMPLATE_PATH.read_text(encoding="utf-8")
        return (
            f"No profile found at {PROFILE_PATH}.\n"
            "Ask the user to paste their Claude custom instructions, CV highlights, "
            "target roles and locations, then save them to that path using this "
            f"template (or call save_candidate_profile):\n\n{template}"
        )
    eligibility = work_eligibility()
    summary = ", ".join(
        f"{k}={'yes' if v else 'no (needs sponsorship)' if v is False else 'not stated'}"
        for k, v in eligibility.items()
    )
    return _read_profile() + f"\n\n---\nParsed work eligibility by region: {summary}\n"


def save_candidate_profile(args):
    content = (args.get("content") or "").strip()
    if not content:
        raise ValueError("content is required")
    _data_dir()
    PROFILE_PATH.write_text(content + "\n", encoding="utf-8")
    return f"Saved profile to {PROFILE_PATH} ({len(content)} characters)."


def list_target_companies(args):
    lane = (args.get("lane") or "").lower()
    region = (args.get("region") or "").lower()
    data = load_company_file()
    eligibility = work_eligibility(regions=data["regions"])
    rows = [
        c for c in data["companies"]
        if (not lane or c.get("lane", "").lower() == lane)
        and (not region or region in c.get("regions", []))
    ]
    source = COMPANIES_PATH if COMPANIES_PATH.exists() else DEFAULT_COMPANIES_PATH
    return {
        "source_file": str(source),
        "lanes": data["lanes"],
        "regions": {
            k: {"label": r["label"], "search_locations": r["search_locations"], "work_eligible": eligibility[k]}
            for k, r in data["regions"].items()
        },
        "count": len(rows),
        "companies": rows,
    }


# --------------------------------------------------------------------------
# Job boards
# --------------------------------------------------------------------------

def http_get_json(url, timeout=HTTP_TIMEOUT):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get_text(url, timeout=PROBE_TIMEOUT, max_bytes=2_000_000):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(max_bytes).decode("utf-8", "replace")


def _ms_to_iso(ms):
    if not ms:
        return None
    return dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone.utc).date().isoformat()


def normalise_greenhouse(company, data):
    return [
        {
            "company": company["name"],
            "title": j.get("title", ""),
            "location": (j.get("location") or {}).get("name", ""),
            "team": ", ".join(d.get("name", "") for d in j.get("departments", []) or []),
            "url": j.get("absolute_url", ""),
            "updated": (j.get("updated_at") or "")[:10] or None,
            "remote": "remote" in ((j.get("location") or {}).get("name", "").lower()),
        }
        for j in data.get("jobs", [])
    ]


def normalise_lever(company, data):
    jobs = []
    for j in data if isinstance(data, list) else []:
        cats = j.get("categories") or {}
        locations = cats.get("allLocations") or [cats.get("location", "")]
        jobs.append({
            "company": company["name"],
            "title": j.get("text", ""),
            "location": " / ".join(l for l in locations if l),
            "team": cats.get("team", ""),
            "url": j.get("hostedUrl", ""),
            "updated": _ms_to_iso(j.get("createdAt")),
            "remote": j.get("workplaceType") == "remote",
        })
    return jobs


def normalise_ashby(company, data):
    jobs = []
    for j in data.get("jobs", []):
        if j.get("isListed") is False:
            continue
        locations = [j.get("location", "")] + [
            s.get("location", "") for s in j.get("secondaryLocations", []) or []
        ]
        jobs.append({
            "company": company["name"],
            "title": j.get("title", ""),
            "location": " / ".join(l for l in locations if l),
            "team": j.get("department", "") or j.get("team", ""),
            "url": j.get("jobUrl", ""),
            "updated": (j.get("publishedAt") or "")[:10] or None,
            "remote": bool(j.get("isRemote")),
        })
    return jobs


ATS = {
    "greenhouse": ("https://boards-api.greenhouse.io/v1/boards/{token}/jobs", normalise_greenhouse),
    "lever": ("https://api.lever.co/v0/postings/{token}?mode=json", normalise_lever),
    "ashby": ("https://api.ashbyhq.com/posting-api/job-board/{token}", normalise_ashby),
}
BOARD_URLS = {
    "greenhouse": "https://boards.greenhouse.io/{token}",
    "lever": "https://jobs.lever.co/{token}",
    "ashby": "https://jobs.ashbyhq.com/{token}",
}


def fetch_company_jobs(company):
    ats = (company.get("ats") or "").lower()
    if ats not in ATS:
        return company["name"], [], f"unsupported ats '{ats}'"
    url_tpl, normalise = ATS[ats]
    url = url_tpl.format(token=urllib.parse.quote(company["token"]))
    try:
        return company["name"], normalise(company, http_get_json(url)), None
    except urllib.error.HTTPError as e:
        return company["name"], [], f"HTTP {e.code} from {url} (board token may be wrong)"
    except Exception as e:  # network errors, bad JSON
        return company["name"], [], f"{type(e).__name__}: {e}"


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _region_patterns(regions):
    return {
        key: re.compile(r"\b(" + "|".join(re.escape(t) for t in r["match"]) + r")\b", re.I)
        for key, r in regions.items()
    }


def regions_for_location(location, patterns):
    return [key for key, pat in patterns.items() if pat.search(location or "")]


def job_matches(job, keywords, exclude, locations, remote_ok, regions=(), remote_regions=()):
    """regions: explicitly requested region keys. remote_regions: regions a remote role may be tied to."""
    title = job["title"].lower()
    if keywords and not any(k.lower() in title for k in keywords):
        return False
    if any(x.lower() in title for x in exclude):
        return False
    if locations or regions:
        loc = job["location"].lower()
        job_regions = set(job.get("regions", []))
        if any(l.lower() in loc for l in locations) or job_regions & set(regions):
            return True
        is_remote = job["remote"] or "remote" in loc
        return remote_ok and is_remote and (not job_regions or bool(job_regions & set(remote_regions)))
    return True


def _search_name(firm):
    return firm.get("search_name") or re.sub(r"\s*\(.*?\)", "", firm["name"]).strip()


def _manual_entry(firm, reason, keywords, search_locations, eligible):
    terms = [f'"{k}"' if " " in k else k for k in keywords[:4]]
    kw = f"({' OR '.join(terms)})" if len(terms) > 1 else "".join(terms)
    domain = urllib.parse.urlparse(firm.get("careers_url") or "").netloc
    links = []
    for loc in search_locations or [""]:
        li = {"keywords": " ".join(t for t in (_search_name(firm), kw) if t)}
        if loc:
            li["location"] = loc
        google = [f"site:{domain}" if domain else f'"{_search_name(firm)}" careers', kw, f'"{loc}"' if loc else ""]
        links.append({
            "location": loc or "any",
            "linkedin_jobs": "https://www.linkedin.com/jobs/search/?" + urllib.parse.urlencode(li),
            "careers_site_search": "https://www.google.com/search?" + urllib.parse.urlencode(
                {"q": " ".join(t for t in google if t)}),
        })
    return {
        "company": firm["name"],
        "lane": firm.get("lane"),
        "status": "manual check",
        "reason": reason,
        "careers_url": firm.get("careers_url"),
        "work_eligible": eligible,
        "search_links": links,
    }


def search_open_roles(args):
    keywords = _as_list(args.get("keywords"))
    exclude = _as_list(args.get("exclude_keywords"))
    locations = _as_list(args.get("locations"))
    remote_ok = bool(args.get("include_remote", True))
    # A city search also returns roles in that region's other cities, ranked after the city asked for.
    other_cities = bool(args.get("include_other_cities", True))
    eligible_only = bool(args.get("eligible_only", False))
    limit = int(args.get("limit") or 50)
    wanted = {c.lower() for c in _as_list(args.get("companies"))}
    lanes = {l.lower() for l in _as_list(args.get("lanes") or args.get("lane"))}

    regions = load_regions()
    patterns = _region_patterns(regions)
    eligibility = work_eligibility(regions=regions)
    explicit_regions = {r.lower() for r in _as_list(args.get("regions"))}
    unknown = explicit_regions - set(regions)
    if unknown:
        raise ValueError(f"unknown regions {sorted(unknown)}; use {sorted(regions)}")
    # A city such as "Toronto" implies its region when choosing which firms to search.
    firm_regions = set(explicit_regions)
    for loc in locations:
        firm_regions.update(regions_for_location(loc, patterns))

    firms = [
        c for c in load_companies()
        if (not wanted or c["name"].lower() in wanted)
        and (not lanes or c.get("lane", "").lower() in lanes)
        and (wanted or not firm_regions or not c.get("regions") or firm_regions & set(c["regions"]))
    ]
    pending = [c["name"] for c in firms if _firm_status(c) == "pending"]
    active = [c for c in firms if _firm_status(c) == "approved"]
    boards = [c for c in active if (c.get("ats") or "").lower() in ATS and c.get("token")]
    board_names = {c["name"] for c in boards}

    if locations:
        search_locations = list(locations)
        if other_cities:
            implied = sorted(firm_regions - explicit_regions)
            search_locations += [l for r in implied for l in regions[r]["search_locations"]
                                 if l.lower() not in {x.lower() for x in search_locations}]
    else:
        search_locations = [l for r in sorted(explicit_regions) for l in regions[r]["search_locations"]]

    def firm_eligibility(firm):
        keys = firm.get("regions", [])
        if firm_regions:
            keys = [k for k in keys if k in firm_regions]
        return _eligibility_for(keys, eligibility)

    manual = []
    for c in active:
        if c["name"] in board_names:
            continue
        ats = c.get("ats")
        reason = (f"{ats} careers site; not searchable through a public API" if ats
                  else "no public Greenhouse/Lever/Ashby board")
        manual.append(_manual_entry(c, reason, keywords, search_locations, firm_eligibility(c)))

    roles, errors, no_matches = [], {}, []
    by_name = {c["name"]: c for c in boards}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for name, jobs, err in pool.map(fetch_company_jobs, boards):
            if err:
                errors[name] = err
                manual.append(_manual_entry(by_name[name], f"board fetch failed: {err}", keywords,
                                            search_locations, firm_eligibility(by_name[name])))
                continue
            matched = 0
            for j in jobs:
                j["regions"] = regions_for_location(j["location"], patterns)
                j["work_eligible"] = _eligibility_for(j["regions"], eligibility)
                match_regions = firm_regions if other_cities else explicit_regions
                if not job_matches(j, keywords, exclude, locations, remote_ok, match_regions, firm_regions):
                    continue
                if locations:
                    if any(l.lower() in j["location"].lower() for l in locations):
                        j["location_match"] = "requested_city"
                    elif set(j["regions"]) & firm_regions:
                        j["location_match"] = "elsewhere_in_region"
                    else:
                        j["location_match"] = "remote"
                if eligible_only and j["work_eligible"] is False:
                    continue
                roles.append(j)
                matched += 1
            if not matched:
                no_matches.append(name)

    roles.sort(key=lambda j: j.get("updated") or "", reverse=True)
    rank = {"requested_city": 0, "elsewhere_in_region": 1, "remote": 2}
    roles.sort(key=lambda j: rank.get(j.get("location_match"), 0))
    return {
        "companies_searched": len(boards),
        "total_matches": len(roles),
        "roles": roles[:limit],
        "manual_check": manual,
        "firms_without_matches": sorted(no_matches),
        "pending_approval_not_searched": sorted(pending),
        "errors": errors,
    }


# --------------------------------------------------------------------------
# Firm discovery
# --------------------------------------------------------------------------

BOARD_LINK_PATTERNS = [
    ("greenhouse", re.compile(r"greenhouse\.io/(?:embed/job_board(?:/js)?\?for=)?([A-Za-z0-9_-]+)", re.I)),
    ("lever", re.compile(r"jobs\.lever\.co/([A-Za-z0-9_.-]+)", re.I)),
    ("ashby", re.compile(r"jobs\.ashbyhq\.com/([A-Za-z0-9_.-]+)", re.I)),
]
NOT_TOKENS = {"embed", "v1", "api", "boards", "js", "job_board"}
OTHER_ATS_HINTS = [
    ("workday", "myworkdayjobs.com"), ("successfactors", "successfactors"),
    ("smartrecruiters", "smartrecruiters.com"), ("taleo", "taleo.net"), ("icims", "icims.com"),
    ("oracle_cloud", "oraclecloud.com"), ("workable", "workable.com"), ("phenom", "phenompeople"),
    ("eightfold", "eightfold.ai"),
]


def _probe_board(ats, token):
    url_tpl, normalise = ATS[ats]
    try:
        data = http_get_json(url_tpl.format(token=urllib.parse.quote(token)), timeout=PROBE_TIMEOUT)
    except Exception:
        return None
    valid = isinstance(data, list) if ats == "lever" else (
        isinstance(data, dict) and isinstance(data.get("jobs"), list))
    if not valid:
        return None
    jobs = normalise({"name": token}, data)
    return {
        "ats": ats, "token": token, "board_url": BOARD_URLS[ats].format(token=token),
        "open_jobs": len(jobs), "sample_titles": [j["title"] for j in jobs[:3]],
    }


def _slug_guesses(name, extra=()):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    ascii_name = re.sub(r"\s*\(.*?\)", "", ascii_name)
    guesses = [*extra, re.sub(r"[^a-z0-9]", "", ascii_name), re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")]
    return [g for g in dict.fromkeys(guesses) if g]


def detect_ats(name, careers_url=None, slugs=()):
    """Find a public Greenhouse/Lever/Ashby board from the careers page, then by slug guesses."""
    hint = None
    if careers_url:
        try:
            html = http_get_text(careers_url)
        except Exception:
            html = ""
        for ats, pattern in BOARD_LINK_PATTERNS:
            for token in dict.fromkeys(pattern.findall(html)):
                if token.lower() in NOT_TOKENS:
                    continue
                found = _probe_board(ats, token)
                if found:
                    return {**found, "method": "careers_page"}
        lower = html.lower()
        hint = next((ats for ats, marker in OTHER_ATS_HINTS if marker in lower), None)
    probes = [(ats, slug) for slug in _slug_guesses(name, slugs) for ats in ATS]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for found in pool.map(lambda p: _probe_board(*p), probes):
            if found:
                return {**found, "method": "name_probe"}
    return {"ats": None, "token": None, "method": "none", "ats_hint": hint}


def discover_firms(args):
    data = load_company_file()
    lane = (args.get("lane") or "").lower()
    if lane not in data["lanes"]:
        raise ValueError(f"lane must be one of {sorted(data['lanes'])}")
    region = (args.get("region") or "").lower()
    if region and region not in data["regions"]:
        raise ValueError(f"region must be one of {sorted(data['regions'])}")
    limit = int(args.get("limit") or 5)
    known = {c["name"].lower() for c in data["companies"]}

    if args.get("candidates"):
        pool = [{"name": c} if isinstance(c, str) else dict(c) for c in args["candidates"]]
        source = "candidates proposed in this call"
    else:
        pool = [
            c for c in _read_json(CANDIDATES_PATH)["candidates"]
            if c.get("lane") == lane and (not region or region in c.get("regions", []))
        ]
        source = f"built-in candidate pool ({CANDIDATES_PATH.name})"
    proposals = [c for c in pool if c.get("name") and c["name"].lower() not in known][:limit]

    def build(candidate):
        found = detect_ats(candidate["name"], candidate.get("careers_url"), _as_list(candidate.get("slugs")))
        entry = {
            "name": candidate["name"],
            "lane": lane,
            "regions": candidate.get("regions") or ([region] if region else []),
            "ats": found["ats"],
            "token": found["token"],
            "careers_url": candidate.get("careers_url"),
            "status": "pending",
            "discovered": dt.date.today().isoformat(),
            "detection": {k: found[k] for k in ("method", "board_url", "ats_hint") if found.get(k)},
        }
        return entry, found

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(build, proposals))
    if results:
        data["companies"].extend(entry for entry, _ in results)
        save_company_file(data)

    return {
        "source": source,
        "companies_file": str(COMPANIES_PATH),
        "added_as_pending": [
            {
                "name": entry["name"],
                "regions": entry["regions"],
                "ats": entry["ats"] or found.get("ats_hint") or "none found (manual check)",
                "board_url": found.get("board_url"),
                "detected_by": found["method"],
                "open_jobs": found.get("open_jobs"),
                "sample_titles": found.get("sample_titles"),
            }
            for entry, found in results
        ],
        "pool_exhausted": len(proposals) < limit,
        "next_step": "Show these to the user. Pending firms are not searched until approve_firms approves them. "
                     "A board found by name_probe may belong to a different company with the same name: "
                     "check the sample titles.",
    }


def approve_firms(args):
    approve = {n.lower() for n in _as_list(args.get("approve"))}
    reject = {n.lower() for n in _as_list(args.get("reject"))}
    if not approve and not reject:
        raise ValueError("pass firm names in approve and/or reject")
    data = load_company_file()
    changed = {"approved": [], "rejected": []}
    for c in data["companies"]:
        key = c["name"].lower()
        if key in approve:
            c["status"] = "approved"
            changed["approved"].append(c["name"])
        elif key in reject:
            c["status"] = "rejected"
            changed["rejected"].append(c["name"])
    found = {n.lower() for n in changed["approved"] + changed["rejected"]}
    save_company_file(data)
    return {**changed, "not_found": sorted((approve | reject) - found), "companies_file": str(COMPANIES_PATH)}


# --------------------------------------------------------------------------
# Recruiters and messages
# --------------------------------------------------------------------------

def find_recruiter_links(args):
    company = (args.get("company") or "").strip()
    if not company:
        raise ValueError("company is required")
    location = (args.get("location") or "").strip()
    focus = (args.get("role_focus") or "").strip()

    def people_search(*terms):
        q = " ".join(t for t in terms if t)
        return "https://www.linkedin.com/search/results/people/?" + urllib.parse.urlencode({"keywords": q})

    xray = f'site:linkedin.com/in "{company}" (recruiter OR "talent acquisition" OR "technical sourcer")'
    if location:
        xray += f' "{location}"'
    if focus:
        xray += f' "{focus}"'

    return {
        "company": company,
        "linkedin_people_search": {
            "recruiters": people_search("recruiter", company, location),
            "talent_acquisition": people_search("talent acquisition", company, location),
            "role_focused": people_search(focus or "technical", "recruiter", company),
            "hiring_managers": people_search(focus or "engineering", "manager", company, location),
        },
        "google_xray_search": "https://www.google.com/search?" + urllib.parse.urlencode({"q": xray}),
        "tips": [
            "Filter by 'Current company' in LinkedIn to drop former employees.",
            "Prefer recruiters whose headline names your function or region.",
            "Check list_outreach first so you do not message the same person twice.",
        ],
    }


def check_message_limits(args):
    channel = args.get("channel", "connection_note")
    text = args.get("text") or ""
    free_account = bool(args.get("free_account", False))
    key = "connection_note_free" if channel == "connection_note" and free_account else channel
    if key not in MESSAGE_LIMITS:
        raise ValueError(f"channel must be one of {sorted(set(MESSAGE_LIMITS) - {'connection_note_free'})}")
    limit = MESSAGE_LIMITS[key]
    warnings = []
    if channel == "connection_note" and VISA_PATTERN.search(text):
        warnings.append("Connection notes must not mention visas, sponsorship or work authorisation. "
                        "Save it for the InMail or a follow-up, and only when the role or region needs it.")
    result = {"channel": key, "length": len(text), "limit": limit, "ok": len(text) <= limit and not warnings,
              "over_by": max(0, len(text) - limit)}
    if key in MESSAGE_TARGETS:
        result["target"] = MESSAGE_TARGETS[key]
        result["over_target"] = len(text) > MESSAGE_TARGETS[key]
    if warnings:
        result["warnings"] = warnings
    subject = args.get("subject")
    if subject is not None:
        result["subject_length"] = len(subject)
        result["subject_ok"] = len(subject) <= MESSAGE_LIMITS["inmail_subject"]
    return result


def _read_rows():
    if not TRACKER_PATH.exists():
        return []
    with open(TRACKER_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _append_row(row):
    _data_dir()
    new_file = not TRACKER_PATH.exists()
    with open(TRACKER_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TRACKER_FIELDS)
        if new_file:
            writer.writeheader()
        writer.writerow({f: str(row.get(f) or "") for f in TRACKER_FIELDS})


def _seed_tracker():
    """Once per data directory, add the recruiters contacted before the tracker existed."""
    seed_path = LOCAL_SEED_PATH if LOCAL_SEED_PATH.exists() else BUNDLED_SEED_PATH
    if SEED_MARKER_PATH.exists() or not seed_path.exists():
        return
    existing = {(r["company"].lower(), r["recruiter_name"].lower()) for r in _read_rows()}
    for contact in _read_json(seed_path)["contacts"]:
        if (contact["company"].lower(), contact["recruiter_name"].lower()) not in existing:
            _append_row({"status": "sent", **contact})
    _data_dir()
    SEED_MARKER_PATH.touch()


def _read_tracker():
    _seed_tracker()
    return _read_rows()


def log_outreach(args):
    for field in ("company", "recruiter_name"):
        if not args.get(field):
            raise ValueError(f"{field} is required")
    _seed_tracker()
    row = {f: str(args.get(f) or "") for f in TRACKER_FIELDS}
    row["date"] = row["date"] or dt.date.today().isoformat()
    row["status"] = row["status"] or "drafted"
    _append_row(row)
    return f"Logged {row['status']} outreach to {row['recruiter_name']} at {row['company']} in {TRACKER_PATH}."


def list_outreach(args):
    company = (args.get("company") or "").lower()
    status = (args.get("status") or "").lower()
    recruiter = (args.get("recruiter") or "").lower()
    rows = [
        r for r in _read_tracker()
        if (not company or company in r["company"].lower() or r["company"].lower() in company)
        and (not status or r["status"].lower() == status)
        and (not recruiter or recruiter in (r["recruiter_name"] + " " + r["recruiter_url"]).lower())
    ]
    return {"tracker_file": str(TRACKER_PATH), "count": len(rows), "rows": rows}


# --------------------------------------------------------------------------
# MCP plumbing
# --------------------------------------------------------------------------

def _schema(properties=None, required=None):
    return {"type": "object", "properties": properties or {}, "required": required or []}


STR = {"type": "string"}
STR_LIST = {"type": "array", "items": {"type": "string"}}

TOOLS = {
    "get_candidate_profile": (
        get_candidate_profile,
        "Read the user's candidate profile: their Claude custom instructions, background, "
        "target roles/locations, work eligibility by region and tone preferences. Call this before drafting.",
        _schema(),
    ),
    "save_candidate_profile": (
        save_candidate_profile,
        "Save (overwrite) the user's candidate profile Markdown. Only call when the user asks.",
        _schema({"content": STR}, ["content"]),
    ),
    "list_target_companies": (
        list_target_companies,
        "List target firms with their lane (consulting, strategy_finance, tech_sales, startup_sales, "
        "luxury), regions (canada, gcc, usa, uk_europe, apac, india), status and careers URL, plus "
        "each region's work_eligible flag from the profile.",
        _schema({"lane": STR, "region": STR}),
    ),
    "search_open_roles": (
        search_open_roles,
        "Search live open roles on approved firms' public Greenhouse/Lever/Ashby boards, filtered by title "
        "keywords, lanes, regions and locations. A city in locations also returns roles in the rest of "
        "that region (e.g. Toronto -> Vancouver, Montreal, Calgary), tagged location_match and ranked "
        "after the city; set include_other_cities false to stay in the city. Firms without a searchable board come back under "
        "manual_check with direct LinkedIn Jobs and careers-site search links; show every one to the user.",
        _schema({
            "keywords": STR_LIST, "exclude_keywords": STR_LIST, "locations": STR_LIST,
            "regions": STR_LIST, "lanes": STR_LIST, "companies": STR_LIST,
            "include_remote": {"type": "boolean"}, "include_other_cities": {"type": "boolean"}, "eligible_only": {"type": "boolean"},
            "limit": {"type": "integer"},
        }),
    ),
    "discover_firms": (
        discover_firms,
        "Propose new firms for a lane (and optionally a region), detect whether each has a public "
        "Greenhouse/Lever/Ashby board, and add them to the user's companies.json as pending. Without "
        "candidates it draws from a built-in pool; pass candidates (names, or objects with name, "
        "careers_url, regions) to propose firms yourself.",
        _schema({
            "lane": STR, "region": STR, "limit": {"type": "integer"},
            "candidates": {"type": "array", "items": {"anyOf": [STR, {"type": "object"}]}},
        }, ["lane"]),
    ),
    "approve_firms": (
        approve_firms,
        "Approve or reject pending firms by name, only on the user's instruction. Approved firms are searched.",
        _schema({"approve": STR_LIST, "reject": STR_LIST}),
    ),
    "find_recruiter_links": (
        find_recruiter_links,
        "Build LinkedIn people-search and Google X-ray links for finding recruiters and hiring "
        "managers at a company. Returns URLs for the user to open; does not scrape LinkedIn.",
        _schema({"company": STR, "location": STR, "role_focus": STR}, ["company"]),
    ),
    "check_message_limits": (
        check_message_limits,
        "Check a draft against LinkedIn length limits and outreach rules. channel: connection_note | "
        "inmail_body | message. InMail bodies have a ~700 character target under the 1,900 limit.",
        _schema({"channel": STR, "text": STR, "subject": STR, "free_account": {"type": "boolean"}},
                ["channel", "text"]),
    ),
    "log_outreach": (
        log_outreach,
        "Append an outreach record to the local CSV tracker. status: drafted | sent | replied | "
        "interview | rejected | no_response.",
        _schema({f: STR for f in TRACKER_FIELDS}, ["company", "recruiter_name"]),
    ),
    "list_outreach": (
        list_outreach,
        "List tracked outreach, optionally filtered by company, status or recruiter name/URL. "
        "Use it to avoid contacting someone twice and to plan follow-ups.",
        _schema({"company": STR, "status": STR, "recruiter": STR}),
    ),
}


def handle(msg):
    method = msg.get("method")
    params = msg.get("params") or {}
    if method == "initialize":
        return {
            "protocolVersion": params.get("protocolVersion") or DEFAULT_PROTOCOL,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        }
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": [
            {"name": name, "description": desc, "inputSchema": schema}
            for name, (_, desc, schema) in TOOLS.items()
        ]}
    if method == "tools/call":
        name = params.get("name")
        if name not in TOOLS:
            raise LookupError(f"unknown tool {name}")
        try:
            result = TOOLS[name][0](params.get("arguments") or {})
            text = result if isinstance(result, str) else json.dumps(result, indent=2, ensure_ascii=False)
            return {"content": [{"type": "text", "text": text}], "isError": False}
        except Exception as e:
            return {"content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}], "isError": True}
    raise NotImplementedError(method)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        if "id" not in msg:  # notification (e.g. notifications/initialized)
            continue
        reply = {"jsonrpc": "2.0", "id": msg["id"]}
        try:
            reply["result"] = handle(msg)
        except (NotImplementedError, LookupError) as e:
            reply["error"] = {"code": -32601, "message": f"Method or tool not found: {e}"}
        except Exception as e:
            reply["error"] = {"code": -32603, "message": str(e)}
        sys.stdout.write(json.dumps(reply) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
