# Recruiter Outreach: a Claude plugin for LinkedIn job outreach

This plugin finds open roles at top companies and startups worldwide, points you to their recruiters
on LinkedIn, and has Claude draft outreach in your own voice, using your Claude instructions and
profile. It also keeps a tracker so nobody gets contacted twice and follow-ups go out on time.

**Claude drafts; you send.** LinkedIn has no API that lets personal apps search people or send
messages, and automating the website breaks the LinkedIn User Agreement and gets accounts
restricted. This plugin never logs in to LinkedIn. It gives you search links and ready-to-paste
messages.

## What's inside

| Part | What it does |
|---|---|
| `server/outreach_server.py` | MCP server written with only the Python standard library, so it needs no `pip install` |
| `skills/recruiter-outreach` | The workflow and personalisation rules Claude follows |
| `server/companies.json` | About 60 target firms in five lanes (`consulting`, `strategy_finance`, `tech_sales`, `startup_sales`, `luxury`) and six regions (`canada`, `gcc`, `usa`, `uk_europe`, `apac`, `india`) |
| `server/firm_candidates.json` | The pool `discover_firms` proposes new firms from |
| `templates/profile.template.md` | Where you put your Claude instructions, CV highlights, locations and work eligibility for each region |

### MCP tools

| Tool | What it does |
|---|---|
| `get_candidate_profile` / `save_candidate_profile` | Read or save your profile at `~/.linkedin-outreach/profile.md` |
| `list_target_companies` | List the target firms by lane and region, with each region's `work_eligible` flag from your profile |
| `search_open_roles` | Search live roles by title keywords, lanes, regions, locations and remote. Searching a city also returns roles elsewhere in its region, ranked after the city itself. For example, Toronto also covers Vancouver, Montreal, Calgary, Ottawa and Waterloo. Pass `include_other_cities: false` to stay in the city. Firms without a public board come back as **manual check** entries with LinkedIn Jobs and careers-site search links, so no firm gets dropped |
| `discover_firms` / `approve_firms` | Propose new firms for a lane and region, detect their job board, and add them as `pending` until you approve them |
| `find_recruiter_links` | Build LinkedIn people-search links and Google X-ray links for recruiters, talent acquisition and hiring managers |
| `check_message_limits` | Check a draft against the connection-note limit (300 characters, or 200 on a free account) and the InMail limit (1,900 characters, with a target of about 700). It also flags any mention of visas in a connection note |
| `log_outreach` / `list_outreach` | Record outreach in the CSV tracker at `~/.linkedin-outreach/outreach_log.csv`. It's seeded with recruiters you contacted before using the plugin (see below) |

## Install

Requirements: Python 3.9 or later, available on your PATH as `python3`.

### Claude Code

```
/plugin marketplace add krishhjain7-lgtm/indiasupply
/plugin install recruiter-outreach@krishh-plugins
```

For a local copy, run `/plugin marketplace add /path/to/indiasupply` instead.

### Claude desktop app

Add the server to `claude_desktop_config.json` (Settings > Developer > Edit Config), then restart the
app:

```json
{
  "mcpServers": {
    "recruiter-outreach": {
      "command": "python3",
      "args": ["/absolute/path/to/linkedin-outreach-plugin/server/outreach_server.py"]
    }
  }
}
```

The desktop app doesn't load plugin skills, so paste the contents of
`skills/recruiter-outreach/SKILL.md` into a Claude Project's instructions.

## First run

1. In claude.ai, open **Settings > Profile** and copy your personal preferences (your "Claude
   instructions").
2. Ask Claude: *"Set up my recruiter outreach profile"*. Then paste those instructions, your CV
   highlights, target roles and locations. Claude saves them to `~/.linkedin-outreach/profile.md`,
   which you can also edit by hand.
3. Fill in **Work eligibility by region** in the profile with `yes` or `no` for each region.
   Claude uses these answers to decide when visa sponsorship is worth mentioning. It never
   mentions sponsorship in a connection note, and only brings it up in an InMail or follow-up when
   the role's region needs it.
4. Ask Claude, for example: *"Find consulting and strategy roles in Toronto and Dubai and draft
   connection notes to their recruiters."*

## Customising companies

To add firms, ask Claude to *"discover more startup_sales firms in gcc"*. Claude adds them to
`~/.linkedin-outreach/companies.json` as `pending`, and they're only searched once you approve them.
From then on that copy is the one used, and the bundled file is never modified.

You can also edit `~/.linkedin-outreach/companies.json` by hand. If it doesn't exist yet, copy it
from `server/companies.json`. Firms without `ats` and `token` are returned as manual checks
through their `careers_url`. A company's `token` is the slug in its board URL:

- `boards.greenhouse.io/<token>`
- `jobs.lever.co/<token>`
- `jobs.ashbyhq.com/<token>`

If a company moves to a different job board, its token stops working. It then shows up under
`errors` in search results, so you know which entry to fix.

## Your data stays out of the repo

Your profile, company list and tracker live only in `~/.linkedin-outreach` on your machine. The
server refuses to write inside this repository, even if `OUTREACH_HOME` points there. The repo's
`.gitignore` also excludes those files if they end up in the working tree.

To keep your data somewhere other than `~/.linkedin-outreach`, set `OUTREACH_HOME` to a folder
outside the repo.

### Seeding the tracker

The first time the tracker is used, it imports recruiters you'd already contacted and marks them
as `sent`. It reads them from `~/.linkedin-outreach/tracker_seed.json`. Keep that file on your
machine. This repo is public, and `server/tracker_seed.json` is gitignored so a list of names can't
be committed by accident. The file looks like this:

```json
{"contacts": [{"company": "Example Co", "recruiter_name": "Jane Doe", "notes": "Talent acquisition, Toronto"}]}
```

## Tests

```
python3 -m unittest discover -s tests
```
