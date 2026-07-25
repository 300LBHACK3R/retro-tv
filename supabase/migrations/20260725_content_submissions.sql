-- Tate's TV public content submissions and protected admin moderation queue.
-- Run this once in the Supabase SQL editor before enabling direct submissions.

create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  kind text not null default 'failzone'
    check (kind in ('failzone', 'creator')),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'changes_requested', 'rejected')),

  submitter_name text not null,
  submitter_email text not null,
  credit_name text,
  content_title text not null,
  description text not null,
  location text,

  object_key text,
  original_filename text,
  mime_type text,
  file_size bigint,
  share_url text,

  rights_confirmations jsonb not null default '{}'::jsonb,
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,

  constraint content_submissions_media_source_check
    check (object_key is not null or share_url is not null)
);

create index if not exists content_submissions_status_created_idx
  on public.content_submissions (status, created_at desc);

create index if not exists content_submissions_kind_created_idx
  on public.content_submissions (kind, created_at desc);

alter table public.content_submissions enable row level security;

-- Intentionally no anonymous/authenticated RLS policies.
-- Public creation and admin moderation both run through validated server routes
-- using the Supabase service-role client.

comment on table public.content_submissions is
  'Tate''s TV FailZone and creator submissions. Service-role API access only.';
