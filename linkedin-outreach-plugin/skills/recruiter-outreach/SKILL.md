---
name: recruiter-outreach
description: Find open roles at top companies and startups worldwide, find their recruiters on LinkedIn, and draft personalised LinkedIn outreach (connection notes, InMails, follow-ups) using the user's saved Claude instructions and candidate profile. Use when the user wants to contact recruiters, find jobs abroad, write LinkedIn messages to hiring teams, or review their outreach pipeline.
---

# Recruiter outreach

Use the `recruiter-outreach` MCP tools. Claude drafts and the user sends: never claim to have sent a
message, and never try to log in to, scrape or automate LinkedIn.

## 1. Load the candidate

1. Call `get_candidate_profile`.
2. If it has no profile yet, ask the user to paste their Claude custom instructions (claude.ai >
   Settings > Profile) and CV highlights. Fill in the template it returns and, once they approve,
   save it with `save_candidate_profile`.
3. The profile's **My Claude instructions** and **Tone and style** sections decide voice, length and
   words to avoid. Where they conflict with this skill, follow the user.

## 2. Find roles

1. Turn the profile's target roles and locations into `search_open_roles` arguments:
   - `lanes`: `consulting`, `strategy_finance`, `tech_sales`, `startup_sales`, `luxury`.
   - `regions`: `canada`, `gcc`, `usa`, `uk_europe`, `apac`, `india`, or specific cities in
     `locations` (for example `["Toronto", "Dubai"]`).
   - Several title variants (for example `["consultant", "associate", "strategy"]`) and
     `exclude_keywords` for wrong seniority (`intern`, `principal`, ...).
2. Each role and firm carries `work_eligible` from the profile's **Work eligibility by region**. Only
   include regions marked `no` if the user wants roles that sponsor visas. If the flags are blank,
   ask the user to fill them in.
3. If the Indeed connector is available, you can also use it for companies not on the list.
4. Show a short table of `roles`: company, title, location, posted date, eligible, link. When the
   user names a city, the results also include the rest of that region by default. For example, a
   Toronto search also covers Vancouver, Montreal, Calgary, Ottawa, Waterloo and other Canadian
   cities. Group the roles by `location_match`: the requested city first, then **elsewhere in the
   region**, then remote. Pass `include_other_cities: false` only if the user wants to stay in one
   city.
5. Then list **every** `manual_check` entry. These are firms without a searchable public board, or
   whose board failed to load. Give each one's reason and its LinkedIn Jobs and careers-site search
   links, and never leave one out. Also mention `firms_without_matches` and
   `pending_approval_not_searched`.
6. Let the user choose which roles to pursue. Aim for about 5 to 10 a session rather than a blast.

### Adding firms

When the user wants more firms in a lane or region, call `discover_firms` with the lane, the region
and a limit. If `pool_exhausted` is true, propose relevant firms yourself and pass them as
`candidates`. For `startup_sales`, propose only B2B startups at Series A to D. Show what was added:
name, detected ATS, board URL, open jobs and sample titles. Point out any `name_probe` board whose
titles don't fit the company. New firms stay **pending** and are not searched. Call
`approve_firms` only with the names the user approves or rejects.

## 3. Find the right person

For each chosen role, call `find_recruiter_links` with the company, the role's city or region, and
its function. Give the user the links and ask them to paste back the name, headline and profile URL
of whoever they pick. Call `list_outreach` with that recruiter first, and flag anyone already
contacted. The tracker comes seeded with recruiters the user contacted before using the plugin.
Those rows have status `sent` and no date, so don't contact them again without the user's say-so.

## 4. Draft the message

Write one message per recruiter. Never reuse a template with the name swapped in.

- **Connection note:** 300 characters maximum, or 200 on a free LinkedIn account. It needs the
  person's name, the exact role title, one specific proof point and a light ask. **Never mention
  visas, sponsorship or work authorisation in a connection note.**
- **InMail or message after connecting:** aim for about 700 characters. The 1,900-character limit is
  a ceiling, not a target. Use a subject line of 8 words or fewer for InMail. Structure it as:
  1. **Why them:** the specific role (with its title and location) and why this company or team.
     Base this on the posting or something public about the company. Never invent a shared
     connection or pretend to know about something.
  2. **Why me:** one or two proof points from the profile that map onto the role's requirements,
     with numbers.
  3. **Logistics, when relevant:** location or relocation, and notice period. Mention visa
     sponsorship only when it's relevant: the role's region has `work_eligible` false, or the
     posting raises work authorisation. In that case, say it briefly and plainly. Leave it out
     entirely for regions where the user is eligible.
  4. **Ask:** one clear, low-effort next step, such as whether they're the right person for this
     role or whether a 15-minute chat is possible. Include the job link.
- **Follow-up:** send one after 5 to 7 business days with no reply. Keep it to 2 or 3 lines, add
  one new piece of value, and don't guilt-trip. The sponsorship rule is the same as for InMail.
- Match the recruiter's region, for example a more formal register for Japan, Germany and
  finance. Write in the local language only if the profile says the user speaks it.
- Never fabricate experience, metrics, referrals or conversations.

Check every draft with `check_message_limits`. Rewrite it if the result has `ok: false` or any
`warnings`, and tighten an InMail if it's `over_target`.

## 5. Hand off and track

Present each draft in a copyable block, with the recruiter's profile URL and the job link above it.
Once the user approves a draft, call `log_outreach` with status `drafted`. When they say they've sent
it, log it again with status `sent`. For a pipeline review, call `list_outreach` and suggest
follow-ups for anything `sent` more than 5 business days ago. For seeded rows with no date, ask
the user when they sent them.

Remind the user once per session to stay within LinkedIn's weekly invitation limits, because
accounts that send many invitations nobody accepts get restricted.
