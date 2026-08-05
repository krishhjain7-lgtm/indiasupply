# Norvian

Norvian makes sourcing from Indian manufacturers safer: find manufacturers,
manage production, and verify every order against the buyer-approved
specification before it ships.

## Repository layout

| Directory | What it is |
| --- | --- |
| [`web/`](./web) | **The production site for norvian.ai.** Next.js + Tailwind + Supabase: landing page, buyer sourcing-request form, manufacturer application form. This is what gets deployed. |
| `frontend/`, `backend/` | Earlier full-platform prototype (CRA + FastAPI + MongoDB, Emergent-hosted). Not part of the norvian.ai deployment. |

Deployment, environment variables and the Supabase schema are documented in
[`web/README.md`](./web/README.md).
