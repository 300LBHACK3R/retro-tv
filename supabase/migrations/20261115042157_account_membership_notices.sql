begin;

-- Extend the existing private outbox. No historic messages are queued.
alter table public.ttv_account_emails drop constraint ttv_account_emails_kind_check;
alter table public.ttv_account_emails add constraint ttv_account_emails_kind_check
  check (kind in ('welcome','membership','renewal_reminder','payment_failed','membership_ending','membership_ended'));
alter table public.ttv_account_emails add column context jsonb;
alter table public.ttv_account_emails add constraint ttv_email_context_size
  check (context is null or (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 2048));

commit;
