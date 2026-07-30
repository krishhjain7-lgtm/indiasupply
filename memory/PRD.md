# Norvian.ai — Product Requirements Doc

## Vision
Trusted, AI-assisted infrastructure for sourcing physical goods from India. Starting with sterling-silver, vermeil, and coloured-gemstone jewellery from Jaipur. Broad enough to later expand into textiles, handicrafts, stone, and specialty foods.

## Personas
- **Buyer**: Overseas brand/retailer/wholesaler/distributor/importer sourcing from India.
- **Exporter**: Indian manufacturer / merchant exporter / export house / trading company.
- **Admin (Norvian)**: Operates the workflow — verifies both sides, matches, coordinates.
- **Visitor**: Anonymous — evaluates the platform before signing up.

## Core Requirements (static)
- Public marketing site with 5-second-clarity positioning.
- Fast onboarding (buyer <1 min, exporter <2 min).
- Multi-step conversational RFQ form with AI-assist (Claude Sonnet 4.5).
- Exporter catalogue + curated public catalogue.
- Admin-mediated exporter invitations, quotations, side-by-side comparison.
- Payment milestones, order assurance checklist, quality inspection.
- Role-based data isolation (buyers/exporters see only their own).
- Emergent Google Auth + Resend transactional email + Managed Object Storage.
- YC demo mode with clearly labelled sample workflow.

## Implemented (2026-02)
- Emergent Google OAuth (session cookie) + owner auto-promote (krishhjain7@gmail.com).
- Buyer & Exporter onboarding flows + public exporter lead form.
- Multi-step RFQ submission (public + logged-in) with reference number NRV-YYYYMM-XXXXX.
- AI-assisted RFQ improvement via Claude Sonnet 4.5 → structured JSON draft.
- File uploads via Emergent Managed Object Storage (auth-gated).
- Curated catalogue (4 seeded products) + Sample-order YC demo endpoint.
- Buyer / Exporter / Admin dashboards with role gating.
- Admin RFQ status transitions across full status vocabulary.
- Resend transactional emails: RFQ confirmation to buyer + notification to admin.
- Marketing pages: Home, How it works, For buyers, For exporters, Jaipur, Catalogue, Privacy, Terms.
- Editorial design system: Cormorant Garamond + Manrope + IBM Plex Mono, warm off-white + bronze accents, no gradients/glassmorphism.

## Backlog (Prioritized)
- **P0** Exporter catalogue upload UI (currently admin-seeds catalogue).
- **P0** Admin quotation comparison side-by-side + internal cost builder.
- **P0** Buyer-facing quotation generator (draft → published).
- **P1** Payment-milestone tracking UI on order detail pages.
- **P1** Order Assurance checklist workflow with per-item toggles.
- **P1** Progressive exporter verification (business / capability / approved-for-order).
- **P2** Clarification-request thread on RFQ (admin ↔ buyer).
- **P2** Documents section (per-order file library).
- **P2** Activity log surfacing in admin UI.
- **P2** Sample & quality-inspection records (photos + AQL).

## Env Vars
- MONGO_URL, DB_NAME (preset)
- EMERGENT_LLM_KEY (universal — Claude, Object Storage)
- EMERGENT_EMAIL_KEY (Resend proxy)
- EMAIL_FROM_NAME=Norvian
- APP_NAME=norvian
- OWNER_EMAIL=krishhjain7@gmail.com
- REACT_APP_BACKEND_URL (frontend)
