-- Run after 20260911_station_insights.sql. Reapplying is safe.
-- Private station measurements only; programming and profiles are untouched.
begin;
create table if not exists public.ttv_analytics_events (
  id uuid primary key,
  created_at timestamptz not null default now(),
  viewer_id uuid not null,
  returning_viewer boolean not null,
  name text not null check (name in ('page_view','profile_start','guide_open','theme_change','cast_attempt','cast_connected','cast_error','playback_start','playback_error','startup_time','page_load','client_error')),
  path text not null check (path in ('/','/tv','/library','/help','/install','/compat','/android','/privacy','/submit')),
  detail text not null check (length(detail) <= 80),
  source text not null check (source in ('direct','internal','search','social','referral')),
  value integer not null check (value between 0 and 120000),
  browser text not null check (browser in ('Safari','Chrome','Firefox','Edge','Samsung Internet','Other')),
  device text not null check (device in ('Phone','Tablet','Computer','TV'))
);
create index if not exists ttv_events_created_idx on public.ttv_analytics_events(created_at);
create index if not exists ttv_events_viewer_idx on public.ttv_analytics_events(viewer_id,created_at);
alter table public.ttv_analytics_events enable row level security;
revoke all on public.ttv_analytics_events from public, anon, authenticated;
grant select, insert, delete on public.ttv_analytics_events to service_role;

create or replace function public.ttv_record_events(viewer_id uuid, returning_viewer boolean, event_batch jsonb, browser_name text, device_type text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if jsonb_typeof(event_batch) <> 'array' or jsonb_array_length(event_batch) not between 1 and 10 then
    raise exception 'Invalid event batch';
  end if;
  delete from public.ttv_analytics_events where created_at < now() - interval '30 days';
  perform pg_advisory_xact_lock(hashtextextended(viewer_id::text, 1));
  if (select count(*) from public.ttv_analytics_events e where e.viewer_id = ttv_record_events.viewer_id and e.created_at > now() - interval '1 minute') + jsonb_array_length(event_batch) > 120 then return; end if;
  insert into public.ttv_analytics_events(id,viewer_id,returning_viewer,name,path,detail,source,value,browser,device)
    select e.id, ttv_record_events.viewer_id, ttv_record_events.returning_viewer,
      e.name,e.path,e.detail,e.source,e.value,browser_name,device_type
    from jsonb_to_recordset(event_batch) as e(id uuid,name text,path text,detail text,source text,value integer)
    on conflict (id) do nothing;
end; $$;

create or replace function public.ttv_growth_insights()
returns jsonb language sql stable security invoker set search_path = public as $$
  with recent as (select * from public.ttv_analytics_events where created_at > now() - interval '7 days'),
  totals as (select count(*) filter (where name='page_view') as page_views,
    count(distinct viewer_id) filter (where name='page_view') as devices,
    count(distinct viewer_id) filter (where name='page_view' and returning_viewer) as returning_devices,
    count(distinct viewer_id) filter (where name='playback_start') as playing_devices,
    count(*) filter (where name='guide_open') as guide_opens,
    count(*) filter (where name='cast_attempt') as cast_attempts,
    count(*) filter (where name='cast_connected') as cast_connections,
    count(*) filter (where name='client_error') as client_errors,
    coalesce(round(avg(value) filter (where name='page_load')),0) as average_page_load_ms from recent),
  days as (select to_char(d.day,'YYYY-MM-DD') as day,
    count(e.id) filter (where e.name='page_view') as page_views,
    count(distinct e.viewer_id) filter (where e.name='page_view') as devices,
    count(distinct e.viewer_id) filter (where e.name='playback_start') as playing_devices
    from generate_series((now() at time zone 'UTC')::date - 6, (now() at time zone 'UTC')::date, interval '1 day') d(day)
    left join recent e on (e.created_at at time zone 'UTC')::date = d.day::date group by d.day order by d.day),
  browsers as (select browser, device, count(distinct viewer_id) as devices,
    count(*) filter (where name='playback_error') as playback_errors,
    count(*) filter (where name='client_error') as client_errors,
    coalesce(round(avg(value) filter (where name='startup_time')),0) as average_startup_ms
    from recent group by browser,device order by count(distinct viewer_id) desc),
  sources as (select source, count(*) as page_views, count(distinct viewer_id) as devices from recent where name='page_view' group by source order by count(*) desc),
  events as (select name,detail,count(*) as count from recent group by name,detail order by count(*) desc),
  pages as (select path,count(*) as page_views from recent where name='page_view' group by path order by count(*) desc)
  select jsonb_build_object('totals',(select row_to_json(totals) from totals),
    'days',coalesce((select jsonb_agg(days) from days),'[]'::jsonb),
    'browsers',coalesce((select jsonb_agg(browsers) from browsers),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(sources) from sources),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(events) from events),'[]'::jsonb),
    'pages',coalesce((select jsonb_agg(pages) from pages),'[]'::jsonb));
$$;
create or replace function public.ttv_prune_playback()
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.ttv_playback_samples where created_at < now() - interval '30 days';
  delete from public.ttv_analytics_events where created_at < now() - interval '30 days';
end; $$;
revoke all on function public.ttv_record_events(uuid,boolean,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.ttv_growth_insights() from public,anon,authenticated;
grant execute on function public.ttv_record_events(uuid,boolean,jsonb,text,text) to service_role;
grant execute on function public.ttv_growth_insights() to service_role;
comment on table public.ttv_analytics_events is 'Optional full-lineup browser activity. No profile IDs, names, PINs, IPs, search terms, raw URLs or user agents. Records older than 30 days pruned during collection and report refresh.';
commit;
