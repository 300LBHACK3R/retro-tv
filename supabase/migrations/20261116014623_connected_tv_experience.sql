begin;
-- Private application state: only authenticated server handlers use these tables.
create table public.ttv_account_devices (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('web','roku')),
  name text not null check (length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index ttv_devices_owner on public.ttv_account_devices(user_id,last_seen_at desc);
alter table public.ttv_account_devices enable row level security;
revoke all on public.ttv_account_devices from public,anon,authenticated;
grant select,insert,update,delete on public.ttv_account_devices to service_role;

create function public.ttv_touch_device(p_user uuid,p_session uuid,p_kind text,p_name text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare allowed boolean;
begin
  insert into public.ttv_account_devices(session_id,user_id,kind,name)
  values(p_session,p_user,p_kind,p_name) on conflict(session_id) do nothing;
  select revoked_at is null into allowed from public.ttv_account_devices
    where session_id=p_session and user_id=p_user;
  if allowed then
    update public.ttv_account_devices set last_seen_at=now()
      where session_id=p_session and user_id=p_user and revoked_at is null
      and last_seen_at < now()-interval '1 minute';
  end if;
  return coalesce(allowed,false);
end; $$;
revoke all on function public.ttv_touch_device(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ttv_touch_device(uuid,uuid,text,text) to service_role;

create table public.ttv_profile_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null check (length(profile_id) between 1 and 60),
  media_id text not null check (length(media_id) between 1 and 240),
  position double precision not null check (position>=0 and position<=duration),
  duration double precision not null check (duration>0 and duration<=604800),
  revision bigint not null default 1,
  playback_id uuid not null,
  sequence integer not null check (sequence>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,profile_id,media_id)
);
create index ttv_progress_recent on public.ttv_profile_progress(user_id,profile_id,updated_at desc);
alter table public.ttv_profile_progress enable row level security;
revoke all on public.ttv_profile_progress from public,anon,authenticated;
grant select,insert,update,delete on public.ttv_profile_progress to service_role;

-- A new playback must start from the observed revision. Retries from that same
-- playback are ordered by sequence, so late network responses cannot rewind it.
create function public.ttv_save_progress(p_user uuid,p_profile text,p_media text,p_position double precision,
  p_duration double precision,p_revision bigint,p_playback uuid,p_sequence integer)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current public.ttv_profile_progress; accepted boolean:=false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_profile,42));
  select * into current from public.ttv_profile_progress where user_id=p_user and profile_id=p_profile and media_id=p_media;
  if current is null and p_revision=0 then
    insert into public.ttv_profile_progress(user_id,profile_id,media_id,position,duration,playback_id,sequence)
      values(p_user,p_profile,p_media,p_position,p_duration,p_playback,p_sequence) returning * into current;
    accepted:=true;
  elsif current.playback_id=p_playback and current.sequence>=p_sequence then
    accepted:=true; -- already accepted retry; never reapply older positions
  elsif current.playback_id=p_playback or current.revision=p_revision then
    update public.ttv_profile_progress set position=p_position,duration=p_duration,
      revision=revision+1,playback_id=p_playback,sequence=p_sequence,updated_at=now()
      where user_id=p_user and profile_id=p_profile and media_id=p_media returning * into current;
    accepted:=true;
  end if;
  delete from public.ttv_profile_progress where user_id=p_user and profile_id=p_profile and media_id in
    (select media_id from public.ttv_profile_progress where user_id=p_user and profile_id=p_profile order by updated_at desc,media_id offset 300);
  return jsonb_build_object('accepted',accepted,'entry',to_jsonb(current));
end; $$;
revoke all on function public.ttv_save_progress(uuid,text,text,double precision,double precision,bigint,uuid,integer) from public,anon,authenticated;
grant execute on function public.ttv_save_progress(uuid,text,text,double precision,double precision,bigint,uuid,integer) to service_role;

create table public.ttv_service_events (
  day date not null default current_date,
  source text not null check(source in ('web','roku','server')),
  category text not null check(category in ('playback','account','sync')),
  code text not null check(length(code) between 1 and 40),
  media_id text not null default '' check(length(media_id)<=240),
  count integer not null default 1,
  last_seen_at timestamptz not null default now(),
  primary key(day,source,category,code,media_id)
);
alter table public.ttv_service_events enable row level security;
revoke all on public.ttv_service_events from public,anon,authenticated;
grant select,insert,update,delete on public.ttv_service_events to service_role;
create function public.ttv_record_service_event(p_source text,p_category text,p_code text,p_media text default '')
returns void language plpgsql security invoker set search_path=public as $$
begin
  insert into public.ttv_service_events(source,category,code,media_id) values(p_source,p_category,p_code,p_media)
    on conflict(day,source,category,code,media_id) do update set count=ttv_service_events.count+1,last_seen_at=now();
  delete from public.ttv_service_events where day<current_date-30;
end; $$;
revoke all on function public.ttv_record_service_event(text,text,text,text) from public,anon,authenticated;
grant execute on function public.ttv_record_service_event(text,text,text,text) to service_role;
comment on table public.ttv_account_devices is 'Verified session IDs only; no tokens, raw user agents, IP addresses or precise location. Revocation tombstones prevent re-enrolment of the same session.';
comment on table public.ttv_profile_progress is 'Private per-household profile progress, capped at 300 items per profile. Server timestamps and ordered playback writes.';
comment on table public.ttv_service_events is 'Daily diagnostic counts only, 30-day retention. No customer IDs, email, IP, raw error messages, credentials or browsing histories.';
create table public.ttv_media_checks (
 media_id text primary key check(length(media_id) between 1 and 240),
 status text not null check(status in ('reachable','broken','unverified')),
 detail text not null check(length(detail)<=300), checked_at timestamptz not null default now()
);
alter table public.ttv_media_checks enable row level security;
revoke all on public.ttv_media_checks from public, anon, authenticated;
grant select,insert,update,delete on public.ttv_media_checks to service_role;
commit;
