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
    {"title": "Senior Product Manager", "location": {"name": "London"}, "absolute_url": "https://gh/1",
     "updated_at": "2026-09-20T10:00:00Z", "departments": [{"name": "Product"}]},
    {"title": "Product Manager Intern", "location": {"name": "London"}, "absolute_url": "https://gh/2",
     "updated_at": "2026-09-21T10:00:00Z"},
    {"title": "Product Manager", "location": {"name": "Remote - EMEA"}, "absolute_url": "https://gh/3",
     "updated_at": "2026-09-10T10:00:00Z"},
    {"title": "Account Executive", "location": {"name": "London"}, "absolute_url": "https://gh/4"},
]}
LEVER = [{"text": "Product Manager, Payments", "categories": {"location": "Bengaluru", "team": "Product"},
          "hostedUrl": "https://lever/1", "createdAt": 1790000000000, "workplaceType": "hybrid"}]
ASHBY = {"jobs": [
    {"title": "Product Manager", "location": "Singapore", "secondaryLocations": [{"location": "Tokyo"}],
     "jobUrl": "https://ashby/1", "publishedAt": "2026-09-25T00:00:00Z", "isRemote": False},
    {"title": "Hidden PM", "location": "Singapore", "isListed": False, "jobUrl": "https://ashby/2"},
]}


def fake_get(url):
    if "greenhouse" in url:
        return GREENHOUSE
    if "lever" in url:
        return LEVER
    if "ashby" in url:
        return ASHBY
    raise AssertionError(url)


COMPANIES = [
    {"name": "GH Co", "ats": "greenhouse", "token": "gh", "segment": "scaleup", "regions": ["UK"]},
    {"name": "Lever Co", "ats": "lever", "token": "lv", "segment": "india", "regions": ["India"]},
    {"name": "Ashby Co", "ats": "ashby", "token": "ab", "segment": "startup", "regions": ["Singapore"]},
]


class ToolTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        home = Path(self.tmp.name)
        self.patches = [
            mock.patch.object(srv, "HOME", home),
            mock.patch.object(srv, "PROFILE_PATH", home / "profile.md"),
            mock.patch.object(srv, "TRACKER_PATH", home / "log.csv"),
            mock.patch.object(srv, "load_companies", lambda: COMPANIES),
            mock.patch.object(srv, "http_get_json", fake_get),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_search_filters_keywords_locations_and_remote(self):
        res = srv.search_open_roles({"keywords": ["product manager"], "exclude_keywords": ["intern"],
                                     "locations": ["London", "Bengaluru", "Tokyo"]})
        urls = [r["url"] for r in res["roles"]]
        self.assertEqual(urls, ["https://ashby/1", "https://lever/1", "https://gh/1", "https://gh/3"])
        self.assertEqual(res["errors"], {})

    def test_search_without_remote(self):
        res = srv.search_open_roles({"keywords": "product manager", "locations": "London",
                                     "include_remote": False, "exclude_keywords": "intern"})
        self.assertEqual([r["url"] for r in res["roles"]], ["https://gh/1"])

    def test_board_errors_are_reported(self):
        def boom(url):
            raise srv.urllib.error.HTTPError(url, 404, "nf", None, None)
        with mock.patch.object(srv, "http_get_json", boom):
            res = srv.search_open_roles({"companies": ["GH Co"]})
        self.assertIn("HTTP 404", res["errors"]["GH Co"])

    def test_profile_roundtrip_and_missing(self):
        self.assertIn("No profile found", srv.get_candidate_profile({}))
        srv.save_candidate_profile({"content": "# Me\nPM in Bengaluru"})
        self.assertIn("PM in Bengaluru", srv.get_candidate_profile({}))

    def test_limits(self):
        self.assertTrue(srv.check_message_limits({"channel": "connection_note", "text": "x" * 300})["ok"])
        r = srv.check_message_limits({"channel": "connection_note", "text": "x" * 250, "free_account": True})
        self.assertEqual((r["ok"], r["over_by"]), (False, 50))

    def test_tracker(self):
        srv.log_outreach({"company": "GH Co", "recruiter_name": "Asha Rao", "status": "sent",
                          "message": "Hi Asha, quick note, with a comma"})
        srv.log_outreach({"company": "Lever Co", "recruiter_name": "Ben Li"})
        self.assertEqual(srv.list_outreach({"recruiter": "asha"})["rows"][0]["status"], "sent")
        self.assertEqual(srv.list_outreach({"status": "drafted"})["count"], 1)

    def test_recruiter_links(self):
        r = srv.find_recruiter_links({"company": "Stripe", "location": "Dublin", "role_focus": "product"})
        self.assertIn("linkedin.com/search/results/people/?keywords=recruiter+Stripe+Dublin",
                      r["linkedin_people_search"]["recruiters"])


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
        self.assertEqual(len(replies[1]["result"]["tools"]), len(srv.TOOLS))
        self.assertTrue(json.loads(replies[2]["result"]["content"][0]["text"])["ok"])
        self.assertEqual(replies[3]["error"]["code"], -32601)

    def test_default_companies_file_is_valid(self):
        data = json.loads((SERVER.parent / "companies.json").read_text())
        for c in data["companies"]:
            self.assertIn(c["ats"], srv.ATS)


if __name__ == "__main__":
    unittest.main()
