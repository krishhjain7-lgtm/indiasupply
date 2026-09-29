import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SERVER = Path(__file__).resolve().parents[1] / "server" / "outreach_server.py"
sys.path.insert(0, str(SERVER.parent))
import outreach_server as srv  # noqa: E402

GREENHOUSE = {"jobs": [
    {"title": "Strategy Consultant", "location": {"name": "Toronto, Canada"}, "absolute_url": "https://gh/1",
     "updated_at": "2026-09-20T10:00:00Z", "departments": [{"name": "Strategy"}]},
    {"title": "Consultant Intern", "location": {"name": "Toronto"}, "absolute_url": "https://gh/2",
     "updated_at": "2026-09-21T10:00:00Z"},
    {"title": "Consultant", "location": {"name": "Remote - Canada"}, "absolute_url": "https://gh/3",
     "updated_at": "2026-09-10T10:00:00Z"},
    {"title": "Consultant", "location": {"name": "Remote - US"}, "absolute_url": "https://gh/4"},
    {"title": "Consultant", "location": {"name": "Remote"}, "absolute_url": "https://gh/5"},
    {"title": "Account Executive", "location": {"name": "Toronto"}, "absolute_url": "https://gh/6"},
]}
LEVER = [{"text": "Senior Consultant", "categories": {"location": "Dubai, UAE", "team": "Strategy"},
          "hostedUrl": "https://lever/1", "createdAt": 1790000000000, "workplaceType": "onsite"}]
ASHBY = {"jobs": [
    {"title": "Consultant", "location": "London", "jobUrl": "https://ashby/1",
     "publishedAt": "2026-09-25T00:00:00Z", "isRemote": False},
    {"title": "Hidden consultant", "location": "Dubai", "isListed": False, "jobUrl": "https://ashby/2"},
]}


def fake_get(url, timeout=None):
    if "greenhouse" in url and "/gh/" in url:
        return GREENHOUSE
    if "lever" in url and "/lv?" in url:
        return LEVER
    if "ashby" in url and url.endswith("/ab"):
        return ASHBY
    raise srv.urllib.error.HTTPError(url, 404, "not found", None, None)


REGIONS = {
    "canada": {"label": "Canada", "search_locations": ["Canada"], "match": ["Canada", "Toronto"]},
    "gcc": {"label": "GCC", "search_locations": ["Dubai", "Doha"], "match": ["Dubai", "UAE", "Doha"]},
    "usa": {"label": "US", "search_locations": ["United States"], "match": ["United States", "US"]},
    "uk_europe": {"label": "UK", "search_locations": ["United Kingdom"], "match": ["London", "UK"]},
}
COMPANY_FILE = {
    "lanes": {"consulting": "", "tech_sales": "", "startup_sales": ""},
    "regions": REGIONS,
    "companies": [
        {"name": "GH Co", "lane": "consulting", "regions": ["canada", "usa"], "ats": "greenhouse", "token": "gh"},
        {"name": "Lever Co", "lane": "consulting", "regions": ["gcc"], "ats": "lever", "token": "lv"},
        {"name": "Ashby Co", "lane": "consulting", "regions": ["uk_europe"], "ats": "ashby", "token": "ab"},
        {"name": "Big Consult (BC)", "lane": "consulting", "regions": ["canada", "gcc"],
         "careers_url": "https://careers.bigconsult.com/jobs"},
        {"name": "Broken Board Co", "lane": "consulting", "regions": ["canada"], "ats": "greenhouse",
         "token": "missing", "careers_url": "https://broken.example/careers"},
        {"name": "Workday Bank", "lane": "tech_sales", "regions": ["gcc"], "ats": "workday",
         "careers_url": "https://bank.example/careers"},
        {"name": "Pending Co", "lane": "consulting", "regions": ["canada"], "status": "pending"},
    ],
}
PROFILE = "# Me\n## Work eligibility by region\n- canada: yes\n- gcc: no, needs sponsorship\n- usa: no\n"


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "data"
        fixtures = Path(self.tmp.name) / "fixtures"
        fixtures.mkdir()
        default = fixtures / "companies.json"
        default.write_text(json.dumps(COMPANY_FILE))
        seed = fixtures / "tracker_seed.json"
        seed.write_text(json.dumps({"contacts": [
            {"company": "BCG", "recruiter_name": "Priya Test", "notes": "Talent acquisition, Toronto"},
            {"company": "IBM", "recruiter_name": "Sam Example"},
        ]}))
        candidates = fixtures / "firm_candidates.json"
        candidates.write_text(json.dumps({"candidates": [
            {"name": "Ashby Co", "lane": "consulting", "regions": ["uk_europe"]},
            {"name": "Ab", "lane": "startup_sales", "regions": ["gcc"]},
            {"name": "Nothing Here", "lane": "startup_sales", "regions": ["gcc"]},
            {"name": "Canada Only", "lane": "startup_sales", "regions": ["canada"]},
        ]}))
        self.patches = [
            mock.patch.object(srv, "HOME", self.home),
            mock.patch.object(srv, "PROFILE_PATH", self.home / "profile.md"),
            mock.patch.object(srv, "COMPANIES_PATH", self.home / "companies.json"),
            mock.patch.object(srv, "TRACKER_PATH", self.home / "log.csv"),
            mock.patch.object(srv, "LOCAL_SEED_PATH", self.home / "tracker_seed.json"),
            mock.patch.object(srv, "SEED_MARKER_PATH", self.home / ".tracker_seeded"),
            mock.patch.object(srv, "DEFAULT_COMPANIES_PATH", default),
            mock.patch.object(srv, "BUNDLED_SEED_PATH", seed),
            mock.patch.object(srv, "CANDIDATES_PATH", candidates),
            mock.patch.object(srv, "http_get_json", fake_get),
            mock.patch.object(srv, "http_get_text", lambda url, **kw: ""),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()


class SearchTests(Base):
    def test_toronto_and_dubai_search(self):
        srv.save_candidate_profile({"content": PROFILE})
        res = srv.search_open_roles({"keywords": ["consultant"], "exclude_keywords": ["intern"],
                                     "locations": ["Toronto", "Dubai"], "lanes": ["consulting"]})
        # Remote-Canada and unscoped remote roles are kept; Remote-US is not; London firm not searched.
        self.assertEqual([r["url"] for r in res["roles"]],
                         ["https://lever/1", "https://gh/1", "https://gh/3", "https://gh/5"])
        by_url = {r["url"]: r for r in res["roles"]}
        self.assertEqual(by_url["https://gh/1"]["work_eligible"], True)
        self.assertEqual(by_url["https://lever/1"]["work_eligible"], False)
        self.assertEqual(by_url["https://lever/1"]["regions"], ["gcc"])

        manual = {m["company"]: m for m in res["manual_check"]}
        self.assertEqual(set(manual), {"Big Consult (BC)", "Broken Board Co"})
        bc = manual["Big Consult (BC)"]
        self.assertEqual(bc["status"], "manual check")
        self.assertEqual([l["location"] for l in bc["search_links"]], ["Toronto", "Dubai"])
        self.assertIn("keywords=Big+Consult+consultant", bc["search_links"][0]["linkedin_jobs"])
        self.assertIn("site%3Acareers.bigconsult.com", bc["search_links"][0]["careers_site_search"])
        self.assertIn("board fetch failed: HTTP 404", manual["Broken Board Co"]["reason"])
        self.assertEqual(res["pending_approval_not_searched"], ["Pending Co"])
        self.assertIn("Broken Board Co", res["errors"])

    def test_no_firm_silently_dropped(self):
        res = srv.search_open_roles({"keywords": ["nonexistent title"]})
        accounted = ({r["company"] for r in res["roles"]} | {m["company"] for m in res["manual_check"]}
                     | set(res["firms_without_matches"]) | set(res["pending_approval_not_searched"]))
        self.assertEqual(accounted, {c["name"] for c in COMPANY_FILE["companies"]})
        workday = next(m for m in res["manual_check"] if m["company"] == "Workday Bank")
        self.assertIn("workday careers site", workday["reason"])

    def test_region_param_and_eligible_only(self):
        srv.save_candidate_profile({"content": PROFILE})
        res = srv.search_open_roles({"keywords": "consultant", "regions": ["gcc"], "eligible_only": True})
        self.assertEqual(res["roles"], [])
        manual = {m["company"]: m for m in res["manual_check"]}
        self.assertEqual([l["location"] for l in manual["Big Consult (BC)"]["search_links"]], ["Dubai", "Doha"])
        self.assertIs(manual["Big Consult (BC)"]["work_eligible"], False)
        with self.assertRaises(ValueError):
            srv.search_open_roles({"regions": ["mars"]})

    def test_list_target_companies_reports_eligibility(self):
        srv.save_candidate_profile({"content": PROFILE})
        res = srv.list_target_companies({"region": "gcc"})
        self.assertEqual({c["name"] for c in res["companies"]}, {"Lever Co", "Big Consult (BC)", "Workday Bank"})
        self.assertEqual({k: v["work_eligible"] for k, v in res["regions"].items()},
                         {"canada": True, "gcc": False, "usa": False, "uk_europe": None})


class DiscoveryTests(Base):
    def test_discover_adds_pending_then_approve(self):
        res = srv.discover_firms({"lane": "startup_sales", "region": "gcc", "limit": 5})
        added = {a["name"]: a for a in res["added_as_pending"]}
        self.assertEqual(set(added), {"Ab", "Nothing Here"})
        self.assertEqual((added["Ab"]["ats"], added["Ab"]["detected_by"], added["Ab"]["open_jobs"]),
                         ("ashby", "name_probe", 1))
        self.assertEqual(added["Nothing Here"]["ats"], "none found (manual check)")
        self.assertTrue(res["pool_exhausted"])

        saved = json.loads((self.home / "companies.json").read_text())
        self.assertEqual({c["name"]: c["status"] for c in saved["companies"] if "status" in c},
                         {"Pending Co": "pending", "Ab": "pending", "Nothing Here": "pending"})
        self.assertIn("Ab", srv.search_open_roles({})["pending_approval_not_searched"])

        out = srv.approve_firms({"approve": ["ab"], "reject": ["Nothing Here", "Ghost"]})
        self.assertEqual((out["approved"], out["rejected"], out["not_found"]), (["Ab"], ["Nothing Here"], ["ghost"]))
        res = srv.search_open_roles({"companies": ["Ab"]})
        self.assertEqual(res["companies_searched"], 1)
        # Already-known firms are not proposed again.
        self.assertEqual(srv.discover_firms({"lane": "startup_sales", "region": "gcc"})["added_as_pending"], [])

    def test_discover_with_claude_candidates_and_careers_page(self):
        html = '<a href="https://boards.greenhouse.io/gh/jobs/1">Jobs</a>'
        with mock.patch.object(srv, "http_get_text", lambda url, **kw: html):
            res = srv.discover_firms({"lane": "consulting", "region": "canada",
                                      "candidates": [{"name": "New Firm", "careers_url": "https://newfirm.example"}]})
        entry = res["added_as_pending"][0]
        self.assertEqual((entry["ats"], entry["detected_by"], entry["regions"]), ("greenhouse", "careers_page", ["canada"]))

    def test_discover_detects_other_ats_hint(self):
        with mock.patch.object(srv, "http_get_text", lambda url, **kw: "x.wd3.myworkdayjobs.com/en-US/careers"):
            res = srv.discover_firms({"lane": "tech_sales", "candidates": [{"name": "Zzz", "careers_url": "https://z"}]})
        self.assertEqual(res["added_as_pending"][0]["ats"], "workday")

    def test_discover_validates_lane(self):
        with self.assertRaises(ValueError):
            srv.discover_firms({"lane": "luxury_yachts"})

    def test_bundled_company_file_untouched(self):
        before = srv.DEFAULT_COMPANIES_PATH.read_text()
        srv.discover_firms({"lane": "startup_sales", "region": "gcc"})
        self.assertEqual(srv.DEFAULT_COMPANIES_PATH.read_text(), before)


class MessageAndTrackerTests(Base):
    def test_limits(self):
        self.assertTrue(srv.check_message_limits({"channel": "connection_note", "text": "x" * 300})["ok"])
        r = srv.check_message_limits({"channel": "connection_note", "text": "x" * 250, "free_account": True})
        self.assertEqual((r["ok"], r["over_by"]), (False, 50))

    def test_visa_never_in_connection_note(self):
        r = srv.check_message_limits({"channel": "connection_note", "text": "Hi Lee, I would need visa sponsorship."})
        self.assertFalse(r["ok"])
        self.assertIn("warnings", r)
        r = srv.check_message_limits({"channel": "inmail_body", "text": "I'd need sponsorship for Dubai."})
        self.assertTrue(r["ok"])
        self.assertNotIn("warnings", r)

    def test_inmail_target(self):
        r = srv.check_message_limits({"channel": "inmail_body", "text": "x" * 900})
        self.assertEqual((r["ok"], r["target"], r["over_target"], r["limit"]), (True, 700, True, 1900))
        self.assertFalse(srv.check_message_limits({"channel": "inmail_body", "text": "x" * 650})["over_target"])

    def test_tracker_seeded_once(self):
        rows = srv.list_outreach({})["rows"]
        self.assertEqual({(r["company"], r["recruiter_name"], r["status"]) for r in rows},
                         {("BCG", "Priya Test", "sent"), ("IBM", "Sam Example", "sent")})
        # "BCG" in the tracker matches the longer firm name used in companies.json.
        self.assertEqual(srv.list_outreach({"company": "Boston Consulting Group (BCG)"})["count"], 1)
        self.assertEqual(srv.list_outreach({"company": "Accenture Strategy"})["count"], 0)
        srv.log_outreach({"company": "Lever Co", "recruiter_name": "Ben Li", "message": "Hi Ben, a note, with commas"})
        self.assertEqual(srv.list_outreach({})["count"], 3)
        self.assertEqual(srv.list_outreach({})["count"], 3)  # seeds are not re-added
        self.assertEqual(srv.list_outreach({"recruiter": "priya"})["rows"][0]["notes"], "Talent acquisition, Toronto")

    def test_local_seed_file_wins(self):
        self.home.mkdir()
        (self.home / "tracker_seed.json").write_text(json.dumps({"contacts": [
            {"company": "Example Co", "recruiter_name": "Jordan Sample"}]}))
        self.assertEqual([r["recruiter_name"] for r in srv.list_outreach({})["rows"]], ["Jordan Sample"])

    def test_profile_roundtrip_and_eligibility(self):
        self.assertIn("No profile found", srv.get_candidate_profile({}))
        srv.save_candidate_profile({"content": PROFILE})
        text = srv.get_candidate_profile({})
        self.assertIn("canada=yes", text)
        self.assertIn("gcc=no (needs sponsorship)", text)
        self.assertIn("uk_europe=not stated", text)

    def test_recruiter_links(self):
        r = srv.find_recruiter_links({"company": "BCG", "location": "Toronto", "role_focus": "consulting"})
        self.assertIn("linkedin.com/search/results/people/?keywords=recruiter+BCG+Toronto",
                      r["linkedin_people_search"]["recruiters"])


class RepoSafetyTests(Base):
    def test_default_data_dir_is_outside_repo(self):
        repo = srv._repo_root()
        self.assertIsNotNone(repo)
        default = Path(os.path.expanduser("~/.linkedin-outreach")).resolve()
        self.assertNotIn(repo, default.parents)

    def test_refuses_to_write_inside_repo(self):
        inside = srv._repo_root() / "linkedin-outreach-plugin" / ".linkedin-outreach"
        with mock.patch.object(srv, "HOME", inside), \
                mock.patch.object(srv, "PROFILE_PATH", inside / "profile.md"):
            with self.assertRaises(RuntimeError):
                srv.save_candidate_profile({"content": "x"})
        self.assertFalse(inside.exists())


class StdioTests(unittest.TestCase):
    def test_protocol(self):
        msgs = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
             "params": {"name": "check_message_limits", "arguments": {"channel": "message", "text": "hi"}}},
            {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "nope"}},
        ]
        with tempfile.TemporaryDirectory() as home:
            out = subprocess.run([sys.executable, str(SERVER)], input="\n".join(json.dumps(m) for m in msgs),
                                 capture_output=True, text=True, env={**os.environ, "OUTREACH_HOME": home},
                                 timeout=30)
        replies = [json.loads(l) for l in out.stdout.splitlines()]
        self.assertEqual([r["id"] for r in replies], [1, 2, 3, 4])
        self.assertEqual(replies[0]["result"]["serverInfo"]["name"], "recruiter-outreach")
        self.assertEqual({t["name"] for t in replies[1]["result"]["tools"]}, set(srv.TOOLS))
        self.assertIn("discover_firms", srv.TOOLS)
        self.assertTrue(json.loads(replies[2]["result"]["content"][0]["text"])["ok"])
        self.assertEqual(replies[3]["error"]["code"], -32601)


class BundledDataTests(unittest.TestCase):
    def test_companies_file(self):
        data = json.loads((SERVER.parent / "companies.json").read_text())
        self.assertEqual(set(data["lanes"]), {"consulting", "strategy_finance", "tech_sales", "startup_sales", "luxury"})
        self.assertEqual(set(data["regions"]), {"canada", "gcc", "usa", "uk_europe", "apac", "india"})
        names = [c["name"] for c in data["companies"]]
        self.assertEqual(len(names), len(set(names)))
        for c in data["companies"]:
            self.assertIn(c["lane"], data["lanes"], c["name"])
            self.assertTrue(set(c["regions"]) <= set(data["regions"]), c["name"])
            self.assertTrue(c.get("careers_url") or c.get("ats") in srv.ATS, c["name"])
            if c.get("ats"):
                self.assertIn(c["ats"], srv.ATS)
                self.assertTrue(c.get("token"), c["name"])
        for firm in ["McKinsey & Company", "Kearney", "ADIA", "Temasek", "Careem", "Chalhoub Group", "Al Tayer Group"]:
            self.assertIn(firm, names)

    def test_candidates_file(self):
        lanes = set(json.loads((SERVER.parent / "companies.json").read_text())["lanes"])
        for c in json.loads((SERVER.parent / "firm_candidates.json").read_text())["candidates"]:
            self.assertIn(c["lane"], lanes, c["name"])

    def test_region_matching_word_boundaries(self):
        regions = json.loads((SERVER.parent / "companies.json").read_text())["regions"]
        pats = srv._region_patterns(regions)
        self.assertEqual(srv.regions_for_location("Brussels, Belgium", pats), ["uk_europe"])
        self.assertEqual(srv.regions_for_location("Remote - US", pats), ["usa"])
        self.assertEqual(srv.regions_for_location("Toronto, ON", pats), ["canada"])
        self.assertEqual(srv.regions_for_location("Riyadh, Saudi Arabia", pats), ["gcc"])


if __name__ == "__main__":
    unittest.main()
