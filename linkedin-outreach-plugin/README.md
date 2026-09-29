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
| `server/companies.json` | A starter list of about 25 public job boards (Greenhouse, Lever, Ashby) across big tech, scaleups, startups and Indian companies |
| `templates/profile.template.md` | Where you put your Claude instructions, CV highlights, locations and visa status |

### MCP tools

| Tool | What it does |
|---|---|
| `get_candidate_profile` / `save_candidate_profile` | Read or save your profile at `~/.linkedin-outreach/profile.md` |
| `list_target_companies` | List the companies whose boards get searched |
| `search_open_roles` | Search live roles by title keywords, locations and remote |
| `find_recruiter_links` | Build LinkedIn people-search links and Google X-ray links for recruiters, talent acquisition and hiring managers |
| `check_message_limits` | Check a draft against the connection-note limit (300 characters, or 200 on a free account) and the InMail limit (1,900 characters) |
| `log_outreach` / `list_outreach` | Record outreach in the CSV tracker at `~/.linkedin-outreach/outreach_log.csv` |

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
   highlights, target roles, the countries you can work in and your visa status. Claude saves them
   to `~/.linkedin-outreach/profile.md`, which you can also edit by hand.
3. Ask Claude, for example: *"Find senior product roles in London, Dublin, Singapore or remote at
   scaleups, and draft connection notes to their recruiters."*

## Customising companies

Copy `server/companies.json` to `~/.linkedin-outreach/companies.json` and edit it. A company's
`token` is the slug in its careers URL:

- `boards.greenhouse.io/<token>`
- `jobs.lever.co/<token>`
- `jobs.ashbyhq.com/<token>`

If a company moves to a different job board, its token stops working. It then shows up under
`errors` in search results, so you know which entry to fix.

Set `OUTREACH_HOME` to keep your profile, company list and tracker somewhere other than
`~/.linkedin-outreach`.

## Tests

```
python3 -m unittest discover -s tests
```
