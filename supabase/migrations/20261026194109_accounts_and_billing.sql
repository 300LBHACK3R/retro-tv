-- Recorded as 20261026194109 on the tates-tv project. Existing programming is untouched.
begin;
create table if not exists public.ttv_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  household jsonb,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint ttv_household_size check (household is null or octet_length(household::text) <= 262144)
);
create table if not exists public.ttv_theme_orders (
  session_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  theme_id text not null,
  payment_intent_id text not null,
  status text not null check (status in ('paid','refunded','disputed','unpaid')),
  event_created bigint not null,
  updated_at timestamptz not null default now()
);
create index if not exists ttv_theme_orders_user on public.ttv_theme_orders(user_id);
create table if not exists public.ttv_memberships (
  subscription_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  status text not null,
  paid boolean not null default false,
  current_period_end timestamptz not null,
  event_created bigint not null,
  updated_at timestamptz not null default now()
);
create index if not exists ttv_memberships_user on public.ttv_memberships(user_id);
create table if not exists public.ttv_billing_events (event_id text primary key, processed_at timestamptz not null default now());
create table if not exists public.ttv_account_limits (key text primary key, attempts integer not null, resets_at timestamptz not null);
create index if not exists ttv_account_limits_expiry on public.ttv_account_limits(resets_at);
-- All access goes through verified server routes. No browser role can grant itself a purchase.
alter table public.ttv_accounts enable row level security;
alter table public.ttv_theme_orders enable row level security;
alter table public.ttv_memberships enable row level security;
alter table public.ttv_billing_events enable row level security;
alter table public.ttv_account_limits enable row level security;
revoke all on public.ttv_accounts, public.ttv_theme_orders, public.ttv_memberships, public.ttv_billing_events, public.ttv_account_limits from public, anon, authenticated;
grant all on public.ttv_accounts, public.ttv_theme_orders, public.ttv_memberships, public.ttv_billing_events, public.ttv_account_limits to service_role;

create or replace function public.ttv_account_rate_limit(bucket_key text, max_requests integer, window_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare attempts_used integer;
begin
  delete from public.ttv_account_limits where resets_at < now() - interval '1 day';
  insert into public.ttv_account_limits as limits(key, attempts, resets_at)
  values(bucket_key, 1, now() + make_interval(secs => window_seconds))
  on conflict(key) do update set
    attempts = case when limits.resets_at <= now() then 1 else limits.attempts + 1 end,
    resets_at = case when limits.resets_at <= now() then now() + make_interval(secs => window_seconds) else limits.resets_at end
  returning attempts into attempts_used;
  return attempts_used <= max_requests;
end $$;

-- The event receipt and entitlement update commit together. Retries and older events are safe.
create or replace function public.ttv_apply_billing_event(event_id text, event_created bigint, theme_order jsonb default null, membership jsonb default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.ttv_billing_events(event_id) values(ttv_apply_billing_event.event_id) on conflict do nothing;
  if not found then return false; end if;
  if theme_order is not null then
    insert into public.ttv_theme_orders as existing(session_id,user_id,theme_id,payment_intent_id,status,event_created)
    values(theme_order->>'session_id',(theme_order->>'user_id')::uuid,theme_order->>'theme_id',theme_order->>'payment_intent_id',theme_order->>'status',ttv_apply_billing_event.event_created)
    on conflict(session_id) do update set status=excluded.status,event_created=excluded.event_created,updated_at=now()
    where excluded.event_created >= existing.event_created;
  end if;
  if membership is not null then
    insert into public.ttv_memberships as existing(subscription_id,user_id,status,paid,current_period_end,event_created)
    values(membership->>'subscription_id',(membership->>'user_id')::uuid,membership->>'status',(membership->>'paid')::boolean,(membership->>'current_period_end')::timestamptz,ttv_apply_billing_event.event_created)
    on conflict(subscription_id) do update set status=excluded.status,paid=excluded.paid,current_period_end=excluded.current_period_end,event_created=excluded.event_created,updated_at=now()
    where excluded.event_created >= existing.event_created;
  end if;
  return true;
end $$;
revoke all on function public.ttv_account_rate_limit(text,integer,integer), public.ttv_apply_billing_event(text,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ttv_account_rate_limit(text,integer,integer), public.ttv_apply_billing_event(text,bigint,jsonb,jsonb) to service_role;
commit;
