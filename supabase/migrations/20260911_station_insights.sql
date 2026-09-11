-- Apply once in the existing Supabase project's SQL editor.
-- No programming, submissions, account, or payment records are changed.
begin;
create table if not exists public.ttv_playback_samples (
  id uuid primary key,
  created_at timestamptz not null default now(),
  viewer_id uuid not null,
  channel_id text not null check (length(channel_id) between 1 and 120),
  media_id text not null check (length(media_id) between 1 and 240),
  mode text not null check (mode in ('live','library')),
  watch_seconds integer not null check (watch_seconds between 0 and 65),
  buffer_seconds integer not null check (buffer_seconds between 0 and 65),
  starts integer not null check (starts between 0 and 1),
  errors integer not null check (errors between 0 and 20),
  startup_ms integer not null check (startup_ms between 0 and 120000),
  reports integer not null check (reports between 0 and 1),
  returning_viewer boolean not null default false
);
create index if not exists ttv_playback_created_idx on public.ttv_playback_samples (created_at);
create index if not exists ttv_playback_viewer_idx on public.ttv_playback_samples (viewer_id, created_at);
alter table public.ttv_playback_samples enable row level security;
revoke all on public.ttv_playback_samples from anon, authenticated;
grant select, insert, delete on public.ttv_playback_samples to service_role;

create or replace function public.ttv_record_playback(sample_id uuid, viewer_id uuid, channel_id text, media_id text,
  playback_mode text, watch_seconds integer, buffer_seconds integer, starts_count integer,
  errors_count integer, startup_ms integer, reports_count integer, returning_viewer boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.ttv_playback_samples where created_at < now() - interval '30 days';
  -- A database lock makes this limit work across serverless instances.
  perform pg_advisory_xact_lock(hashtextextended(viewer_id::text, 0));
  if (select count(*) from public.ttv_playback_samples s where s.viewer_id = ttv_record_playback.viewer_id and s.created_at > now() - interval '1 minute') >= 30 then return; end if;
  insert into public.ttv_playback_samples (id, viewer_id, channel_id, media_id, mode, watch_seconds, buffer_seconds, starts, errors, startup_ms, reports, returning_viewer)
  values (sample_id, viewer_id, channel_id, media_id, playback_mode, watch_seconds, buffer_seconds, starts_count, errors_count, startup_ms, reports_count, returning_viewer)
  on conflict (id) do nothing;
end; $$;

create or replace function public.ttv_station_insights()
returns jsonb language sql stable security invoker set search_path = public as $$
  with recent as (select * from public.ttv_playback_samples where created_at > now() - interval '7 days'),
  totals as (select count(distinct viewer_id) as viewers,
    count(distinct viewer_id) filter (where returning_viewer) as returning_viewers,
    coalesce(sum(watch_seconds),0) as watch_seconds, coalesce(sum(buffer_seconds),0) as buffer_seconds,
    coalesce(sum(starts),0) as starts, coalesce(sum(errors),0) as errors, coalesce(sum(reports),0) as reports,
    coalesce(round(avg(startup_ms) filter (where starts > 0)),0) as average_startup_ms from recent),
  channels as (select channel_id, sum(watch_seconds) as watch_seconds, sum(errors) as errors, count(distinct viewer_id) as viewers from recent group by channel_id order by sum(watch_seconds) desc limit 30),
  issues as (select media_id, sum(errors) as errors, sum(reports) as reports from recent group by media_id having sum(errors) + sum(reports) > 0 order by sum(errors) + sum(reports) desc limit 30)
  select jsonb_build_object('totals',(select row_to_json(totals) from totals), 'channels',coalesce((select jsonb_agg(channels) from channels),'[]'::jsonb), 'issues',coalesce((select jsonb_agg(issues) from issues),'[]'::jsonb));
$$;

create or replace function public.ttv_prune_playback()
returns void language sql security invoker set search_path = public as $$
  delete from public.ttv_playback_samples where created_at < now() - interval '30 days';
$$;
revoke all on function public.ttv_record_playback(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer,boolean) from public, anon, authenticated;
revoke all on function public.ttv_station_insights() from public, anon, authenticated;
revoke all on function public.ttv_prune_playback() from public, anon, authenticated;
grant execute on function public.ttv_record_playback(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer,boolean) to service_role;
grant execute on function public.ttv_station_insights() to service_role;
grant execute on function public.ttv_prune_playback() to service_role;
comment on table public.ttv_playback_samples is 'Anonymous playback totals. No IP addresses, emails, raw URLs, or account data. Pruned during collection and station-report refresh.';
commit;
