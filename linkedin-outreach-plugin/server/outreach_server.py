#!/usr/bin/env python3
"""Recruiter outreach MCP server (stdio, Python standard library only).

Gives Claude the tools it needs to personalise recruiter outreach:
  * your candidate profile / Claude instructions (a local Markdown file)
  * open roles pulled from public ATS job boards (Greenhouse, Lever, Ashby)
  * LinkedIn / Google search links to find the recruiters for a company
  * LinkedIn message length limits
  * a local CSV tracker so nobody is contacted twice

It never logs in to LinkedIn and never sends anything: LinkedIn does not offer
an API for this and automating the website breaks its User Agreement. Claude
drafts, you review and send.
"""

import csv
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SERVER_NAME = "recruiter-outreach"
SERVER_VERSION = "0.1.0"
DEFAULT_PROTOCOL = "2025-06-18"

HERE = Path(__file__).resolve().parent
HOME = Path(os.environ.get("OUTREACH_HOME") or Path.home() / ".linkedin-outreach")
PROFILE_PATH = HOME / "profile.md"
COMPANIES_PATH = HOME / "companies.json"
TRACKER_PATH = HOME / "outreach_log.csv"
DEFAULT_COMPANIES_PATH = HERE / "companies.json"
PROFILE_TEMPLATE_PATH = HERE.parent / "templates" / "profile.template.md"

HTTP_TIMEOUT = 15
USER_AGENT = "recruiter-outreach-mcp/0.1 (+personal job search)"

# Character limits LinkedIn enforces (as of 2026). Free accounts get a shorter
# connection note than Premium.
MESSAGE_LIMITS = {
    "connection_note": 300,
    "connection_note_free": 200,
    "inmail_subject": 200,
    "inmail_body": 1900,
    "message": 8000,
}

TRACKER_FIELDS = [
    "date", "company", "recruiter_name", "recruiter_url", "role_title",
    "role_url", "channel", "status", "message", "notes",
]


# --------------------------------------------------------------------------
# Data files
# --------------------------------------------------------------------------

def load_companies():
    path = COMPANIES_PATH if COMPANIES_PATH.exists() else DEFAULT_COMPANIES_PATH
    with open(path, encoding="utf-8") as f:
        return json.load(f)["companies"]


def get_candidate_profile(_args):
    if not PROFILE_PATH.exists():
        template = PROFILE_TEMPLATE_PATH.read_text(encoding="utf-8")
        return (
            f"No profile found at {PROFILE_PATH}.\n"
            "Ask the user to paste their Claude custom instructions, CV highlights, "
            "target roles and locations, then save them to that path using this "
            f"template (or call save_candidate_profile):\n\n{template}"
        )
    return PROFILE_PATH.read_text(encoding="utf-8")


def save_candidate_profile(args):
    content = (args.get("content") or "").strip()
    if not content:
        raise ValueError("content is required")
    HOME.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(content + "\n", encoding="utf-8")
    return f"Saved profile to {PROFILE_PATH} ({len(content)} characters)."


def list_target_companies(args):
    segment = (args.get("segment") or "").lower()
    region = (args.get("region") or "").lower()
    rows = [
        c for c in load_companies()
        if (not segment or c.get("segment", "").lower() == segment)
        and (not region or region in " ".join(c.get("regions", [])).lower())
    ]
    source = COMPANIES_PATH if COMPANIES_PATH.exists() else DEFAULT_COMPANIES_PATH
    return {"source_file": str(source), "count": len(rows), "companies": rows}


# --------------------------------------------------------------------------
# Job boards
# --------------------------------------------------------------------------

def http_get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


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


def fetch_company_jobs(company):
    ats = company.get("ats", "").lower()
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


def job_matches(job, keywords, exclude, locations, remote_ok):
    title = job["title"].lower()
    if keywords and not any(k.lower() in title for k in keywords):
        return False
    if any(x.lower() in title for x in exclude):
        return False
    if locations:
        loc = job["location"].lower()
        if not any(l.lower() in loc for l in locations):
            return remote_ok and (job["remote"] or "remote" in loc)
    return True


def search_open_roles(args):
    keywords = _as_list(args.get("keywords"))
    exclude = _as_list(args.get("exclude_keywords"))
    locations = _as_list(args.get("locations"))
    remote_ok = bool(args.get("include_remote", True))
    limit = int(args.get("limit") or 50)
    wanted = {c.lower() for c in _as_list(args.get("companies"))}
    segment = (args.get("segment") or "").lower()

    companies = [
        c for c in load_companies()
        if (not wanted or c["name"].lower() in wanted)
        and (not segment or c.get("segment", "").lower() == segment)
    ]
    if not companies:
        return {"roles": [], "errors": {}, "note": "No companies matched; see list_target_companies."}

    roles, errors = [], {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for name, jobs, err in pool.map(fetch_company_jobs, companies):
            if err:
                errors[name] = err
            roles.extend(j for j in jobs if job_matches(j, keywords, exclude, locations, remote_ok))

    roles.sort(key=lambda j: j.get("updated") or "", reverse=True)
    return {
        "companies_searched": len(companies),
        "total_matches": len(roles),
        "roles": roles[:limit],
        "errors": errors,
    }


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
    result = {"channel": key, "length": len(text), "limit": limit, "ok": len(text) <= limit,
              "over_by": max(0, len(text) - limit)}
    subject = args.get("subject")
    if subject is not None:
        result["subject_length"] = len(subject)
        result["subject_ok"] = len(subject) <= MESSAGE_LIMITS["inmail_subject"]
    return result


def _read_tracker():
    if not TRACKER_PATH.exists():
        return []
    with open(TRACKER_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def log_outreach(args):
    for field in ("company", "recruiter_name"):
        if not args.get(field):
            raise ValueError(f"{field} is required")
    row = {f: str(args.get(f) or "") for f in TRACKER_FIELDS}
    row["date"] = row["date"] or dt.date.today().isoformat()
    row["status"] = row["status"] or "drafted"
    HOME.mkdir(parents=True, exist_ok=True)
    new_file = not TRACKER_PATH.exists()
    with open(TRACKER_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TRACKER_FIELDS)
        if new_file:
            writer.writeheader()
        writer.writerow(row)
    return f"Logged {row['status']} outreach to {row['recruiter_name']} at {row['company']} in {TRACKER_PATH}."


def list_outreach(args):
    company = (args.get("company") or "").lower()
    status = (args.get("status") or "").lower()
    recruiter = (args.get("recruiter") or "").lower()
    rows = [
        r for r in _read_tracker()
        if (not company or r["company"].lower() == company)
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
        "target roles/locations, work authorisation and tone preferences. Call this before drafting.",
        _schema(),
    ),
    "save_candidate_profile": (
        save_candidate_profile,
        "Save (overwrite) the user's candidate profile Markdown. Only call when the user asks.",
        _schema({"content": STR}, ["content"]),
    ),
    "list_target_companies": (
        list_target_companies,
        "List the companies whose public job boards are searched, with segment "
        "(big_tech, scaleup, startup, finance, india) and hiring regions.",
        _schema({"segment": STR, "region": STR}),
    ),
    "search_open_roles": (
        search_open_roles,
        "Search live open roles on target companies' public Greenhouse/Lever/Ashby job boards. "
        "Filters by title keywords and locations (substring match, remote roles kept when include_remote).",
        _schema({
            "keywords": STR_LIST, "exclude_keywords": STR_LIST, "locations": STR_LIST,
            "companies": STR_LIST, "segment": STR,
            "include_remote": {"type": "boolean"}, "limit": {"type": "integer"},
        }),
    ),
    "find_recruiter_links": (
        find_recruiter_links,
        "Build LinkedIn people-search and Google X-ray links for finding recruiters and hiring "
        "managers at a company. Returns URLs for the user to open; does not scrape LinkedIn.",
        _schema({"company": STR, "location": STR, "role_focus": STR}, ["company"]),
    ),
    "check_message_limits": (
        check_message_limits,
        "Check a draft against LinkedIn length limits. channel: connection_note | inmail_body | message.",
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
