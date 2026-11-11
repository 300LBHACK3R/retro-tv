begin;

-- A durable, private transactional outbox. Existing accounts are NOT backfilled.
create table public.ttv_account_emails (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'membership')),
  subscription_id text,
  status text not null default 'pending' check (status in ('pending','sending','accepted','review','canceled')),
  payload jsonb,
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint ttv_email_payload_size check (payload is null or octet_length(payload::text) <= 65536)
);
create index ttv_account_emails_pending on public.ttv_account_emails(next_attempt_at) where status in ('pending','sending');
create index ttv_account_emails_user on public.ttv_account_emails(user_id);
alter table public.ttv_account_emails enable row level security;
revoke all on public.ttv_account_emails from public, anon, authenticated;
grant all on public.ttv_account_emails to service_role;

-- Only verified server routes create account rows. The sender independently
-- verifies the recipient with Auth immediately before sending.
create function public.ttv_queue_account_welcome() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.ttv_account_emails(dedupe_key,user_id,kind)
  values ('welcome:' || new.user_id::text,new.user_id,'welcome')
  on conflict(dedupe_key) do nothing;
  return new;
end $$;
revoke all on function public.ttv_queue_account_welcome() from public, anon, authenticated;
grant execute on function public.ttv_queue_account_welcome() to service_role;
create trigger ttv_queue_account_welcome after insert on public.ttv_accounts
for each row execute function public.ttv_queue_account_welcome();

create function public.ttv_queue_membership_welcome() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is not null and new.status = 'active' and new.paid = true and new.current_period_end > now() then
    if tg_op = 'INSERT' or old.status <> 'active' or old.paid <> true then
      insert into public.ttv_account_emails(dedupe_key,user_id,kind,subscription_id)
      values ('membership:' || new.subscription_id,new.user_id,'membership',new.subscription_id)
      on conflict(dedupe_key) do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.ttv_queue_membership_welcome() from public, anon, authenticated;
grant execute on function public.ttv_queue_membership_welcome() to service_role;
create trigger ttv_queue_membership_welcome after insert or update on public.ttv_memberships
for each row execute function public.ttv_queue_membership_welcome();

-- Lock rows before claiming so concurrent requests cannot send the same message.
create function public.ttv_claim_account_emails(for_user uuid default null, batch_size integer default 2)
returns setof public.ttv_account_emails
language plpgsql security invoker set search_path = '' as $$
begin
  -- Resend retains idempotency keys for 24h. An uncertain old attempt must be
  -- reconciled with the provider manually, never blindly resent after expiry.
  update public.ttv_account_emails set status = 'review', last_error = 'idempotency_window_expired', lease_until = null
  where status in ('pending','sending') and first_attempt_at < now() - interval '23 hours'
    and (lease_until is null or lease_until <= now()) and (for_user is null or user_id = for_user);
  return query
  with picked as (
    select id from public.ttv_account_emails
    where status in ('pending','sending') and next_attempt_at <= now()
      and (lease_until is null or lease_until <= now())
      and (for_user is null or user_id = for_user)
    order by created_at, id for update skip locked limit greatest(1,least(batch_size,5))
  )
  update public.ttv_account_emails as messages
  set status = 'sending', lease_until = now() + interval '2 minutes', lease_token = gen_random_uuid(), attempts = attempts + 1
  from picked where messages.id = picked.id returning messages.*;
end $$;
revoke all on function public.ttv_claim_account_emails(uuid,integer) from public, anon, authenticated;
grant execute on function public.ttv_claim_account_emails(uuid,integer) to service_role;

commit;
