# Norvian — norvian.ai

Marketing site plus the two forms that actually matter: the buyer sourcing
request (RFQ) and the manufacturer network application. Both write to Supabase
through server-side API routes.

- **Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Supabase (Postgres +
  Storage) · Resend (optional)
- **Deploy target:** Vercel, root directory `web`

---

## 1. Set up Supabase (5 minutes)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste all of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the
   `sourcing_requests` and `manufacturer_applications` tables, enables RLS with
   no public policies, and creates the private `rfq-references` storage bucket.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
     (`NEXT_PUBLIC_SUPABASE_URL` also works, but it is inlined at build time —
     if you set it after a deploy you must redeploy for it to take effect.)
   - **`service_role` secret** → `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is a server-only secret. It is never bundled into the
browser — it is read exclusively inside `src/app/api/*` route handlers.

## 2. Environment variables

Copy `.env.example` to `.env.local` for local work, and set the same values in
Vercel under **Project → Settings → Environment Variables**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side writes (bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical URL for OG tags, sitemap, robots |
| `SUPABASE_UPLOAD_BUCKET` | no | Defaults to `rfq-references` |
| `RESEND_API_KEY` | no | Email alert on each submission |
| `NOTIFY_EMAIL_TO` | no | Where alerts go |
| `NOTIFY_EMAIL_FROM` | no | Verified Resend sender |

Email is entirely optional and fails soft: a submission is stored before the
email is attempted, so an email outage can never lose a lead.

## 3. Deploy

```
Vercel → Add New Project → import this repo
  Root Directory:  web
  Framework:       Next.js  (auto-detected)
  Build command:   next build  (default)
```

Add the environment variables, deploy, then point `norvian.ai` at the project
under **Settings → Domains**.

## 4. Verify the deployment

```bash
curl https://norvian.ai/api/health
```

- `{"ok":true,"supabase":"configured","tables":{...}}` — the running instance
  can reach both tables. Submissions will persist.
- `503 {"supabase":"not-configured"}` — environment variables are missing.
  **Fix this before sharing the link**; submissions will fail.

Then submit one real request through the site and confirm the row appears in
Supabase.

## 5. Reading submissions

Supabase Dashboard → **Table Editor** → `sourcing_requests`, sorted newest
first. `manufacturer_applications` holds the manufacturer side. Both have a
`status` column defaulting to `new` that you can edit in place as you work
through them. There is deliberately no admin dashboard.

To export: **Table Editor → ⋯ → Download as CSV**.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Without Supabase credentials, `NODE_ENV !== "production"` makes submissions
append to `.data/*.jsonl` so the flow is testable offline. That fallback is
disabled in production builds — a misconfigured production deploy returns a
clear error rather than silently dropping a lead onto a disposable filesystem.

```bash
npm run build      # production build
npm run lint
```

## Layout

```
src/app/            routes, metadata, favicon + OG image generation
src/app/api/        rfq · manufacturers · upload · health
src/components/     landing sections, modal shell, both forms
src/lib/db.ts       Supabase client, inserts, uploads, reference numbers
src/lib/validation.ts  zod schemas shared by the client and the API routes
supabase/schema.sql    run once in the SQL editor
```
