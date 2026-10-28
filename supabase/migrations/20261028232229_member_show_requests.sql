begin;
create table public.ttv_show_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  release_year integer check (release_year between 1900 and 2100),
  seasons text not null default '' check (char_length(seasons) <= 80),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'requested' check (status in ('requested','reviewing','planned','added','unavailable')),
  member_reply text not null default '' check (char_length(member_reply) <= 1000),
  admin_notes text not null default '' check (char_length(admin_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ttv_show_requests_user_date on public.ttv_show_requests(user_id, created_at desc, id desc);
create index ttv_show_requests_status_date on public.ttv_show_requests(status, created_at, id);
create index ttv_show_requests_date on public.ttv_show_requests(created_at, id);
create unique index ttv_show_requests_duplicate on public.ttv_show_requests
  (user_id, lower(title), coalesce(release_year, 0), lower(seasons));
-- Verified Next.js routes are the only entry point. The browser cannot read
-- other households' requests, change review status, or grant itself access.
alter table public.ttv_show_requests enable row level security;
revoke all on public.ttv_show_requests from public, anon, authenticated;
grant select, insert, update, delete on public.ttv_show_requests to service_role;

create function public.ttv_submit_show_request(requester uuid, show_title text, show_year integer, show_seasons text, show_details text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  request_id uuid;
  clean_title text := regexp_replace(btrim(show_title), '\s+', ' ', 'g');
  clean_seasons text := regexp_replace(btrim(show_seasons), '\s+', ' ', 'g');
begin
  -- Lock the existing household row so simultaneous submissions cannot exceed
  -- the limit. Membership is read from verified billing records, never the UI.
  perform 1 from public.ttv_accounts where user_id = requester for update;
  if not found or not exists (
    select 1 from public.ttv_memberships where user_id = requester
      and status = 'active' and paid = true and current_period_end > now()
  ) then raise exception 'membership_required'; end if;
  select id into request_id from public.ttv_show_requests
    where user_id = requester and lower(title) = lower(clean_title)
      and coalesce(release_year, 0) = coalesce(show_year, 0) and lower(seasons) = lower(clean_seasons);
  if found then return jsonb_build_object('id', request_id, 'duplicate', true); end if;
  if (select count(*) from public.ttv_show_requests where user_id = requester
    and status in ('requested','reviewing','planned')) >= 5 then
    raise exception 'request_limit';
  end if;
  insert into public.ttv_show_requests(user_id, title, release_year, seasons, details)
    values(requester, clean_title, show_year, clean_seasons, btrim(show_details)) returning id into request_id;
  return jsonb_build_object('id', request_id, 'duplicate', false);
end $$;
revoke all on function public.ttv_submit_show_request(uuid,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.ttv_submit_show_request(uuid,text,integer,text,text) to service_role;
commit;
