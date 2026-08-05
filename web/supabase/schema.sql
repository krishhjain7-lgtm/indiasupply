-- Norvian MVP schema.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Buyer sourcing requests
-- ---------------------------------------------------------------------------
create table if not exists public.sourcing_requests (
  id                       uuid primary key default gen_random_uuid(),
  reference_number         text not null unique,
  created_at               timestamptz not null default now(),
  name                     text not null,
  company                  text not null,
  email                    text not null,
  phone                    text,
  website                  text,
  category                 text not null,
  product_name             text not null,
  description              text not null,
  quantity                 text not null,
  target_price             text,
  materials_specifications text,
  delivery_date            date,
  destination              text,
  reference_file_url       text,
  status                   text not null default 'new'
);

create index if not exists sourcing_requests_created_at_idx
  on public.sourcing_requests (created_at desc);

-- ---------------------------------------------------------------------------
-- Manufacturer network applications
-- ---------------------------------------------------------------------------
create table if not exists public.manufacturer_applications (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  name               text not null,
  company            text not null,
  email              text not null,
  phone              text,
  city               text,
  product_categories text,
  website            text,
  export_experience  text,
  status             text not null default 'new'
);

create index if not exists manufacturer_applications_created_at_idx
  on public.manufacturer_applications (created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- The app writes exclusively from server-side API routes using the service-role
-- key, which bypasses RLS. So RLS is enabled with NO policies: anon and
-- authenticated keys can neither read nor write these tables, even if the
-- publishable key leaks. The Supabase dashboard still shows every row.
-- ---------------------------------------------------------------------------
alter table public.sourcing_requests        enable row level security;
alter table public.manufacturer_applications enable row level security;

revoke all on public.sourcing_requests        from anon, authenticated;
revoke all on public.manufacturer_applications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private bucket for buyer reference images / spec sheets.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('rfq-references', 'rfq-references', false)
on conflict (id) do nothing;
