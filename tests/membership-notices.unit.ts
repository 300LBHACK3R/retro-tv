import { test, expect } from '@playwright/test';
import type Stripe from 'stripe';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { membershipNotice, membershipNoticeCurrent, isMembershipNotice } from '../lib/membershipNotices';
import { accountEmail } from '../lib/accountEmails';

const now = 1800000000;
const end = now + 3 * 86400;
function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return { id: 'sub_one', status: 'active', latest_invoice: { id: 'in_one', status: 'paid' }, cancel_at_period_end: false,
    cancel_at: null, items: { data: [{ current_period_end: end }] }, ...overrides } as Stripe.Subscription;
}

test('billing reminders are keyed by invoice or period, never by webhook delivery attempts', () => {
  const active = subscription();
  const reminder = membershipNotice(active, end, 'invoice.upcoming', now)!;
  expect(reminder.key).toBe(`renewal:sub_one:${end}`);
  expect(membershipNotice(active, end, 'invoice.paid', now)).toBeNull();
  const failed = subscription({ status: 'past_due', latest_invoice: { id: 'in_one', status: 'open' } as Stripe.Invoice });
  expect(membershipNotice(failed, end, 'invoice.payment_failed', now)?.key).toBe('payment-failed:in_one');
  expect(membershipNotice(active, end, 'invoice.payment_failed', now)).toBeNull();
});

test('stale reminders are suppressed after renewal, cancellation, resumption or payment recovery', () => {
  const context = { periodEnd: end, invoiceId: 'in_one' };
  expect(membershipNoticeCurrent('renewal_reminder', context, subscription(), now)).toBe(true);
  expect(membershipNoticeCurrent('renewal_reminder', context, subscription({ cancel_at_period_end: true }), now)).toBe(false);
  expect(membershipNoticeCurrent('renewal_reminder', context, subscription(), end + 1)).toBe(false);
  expect(membershipNoticeCurrent('renewal_reminder', context, subscription({ items: { data: [{ current_period_end: end + 86400 }] } as Stripe.ApiList<Stripe.SubscriptionItem> }), now)).toBe(false);
  expect(membershipNoticeCurrent('payment_failed', context, subscription(), now)).toBe(false);
  const ending = subscription({ cancel_at_period_end: true });
  expect(membershipNotice(ending, end, 'customer.subscription.updated', now)?.kind).toBe('membership_ending');
  expect(membershipNotice(ending, end, 'invoice.upcoming', now)).toBeNull();
  expect(membershipNoticeCurrent('membership_ending', context, ending, now)).toBe(true);
  expect(membershipNoticeCurrent('membership_ending', context, subscription(), now)).toBe(false);
  // A cancellation scheduled beyond the paid period still has renewals ahead.
  expect(membershipNotice(subscription({ cancel_at: end + 86400 }), end, 'customer.subscription.updated', now)).toBeNull();
  expect(membershipNoticeCurrent('membership_ending', { periodEnd: end + 86400 }, subscription({ cancel_at: end + 86400 }), now)).toBe(false);
  expect(membershipNoticeCurrent('membership_ended', context, subscription({ status: 'canceled' }), now)).toBe(true);
});

test('notices remain private, accept bounded context and queue only once under retries', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
    for (const path of ['20261026194109_accounts_and_billing.sql', '20261111151806_account_welcome_emails.sql', '20261115042157_account_membership_notices.sql'])
      await db.exec(readFileSync(`supabase/migrations/${path}`, 'utf8'));
    expect((await db.query('select * from public.ttv_account_emails')).rows).toHaveLength(0);
    await db.exec("insert into auth.users values ('11111111-1111-4111-8111-111111111111'); set role service_role;");
    const sql = "insert into public.ttv_account_emails(user_id,kind,dedupe_key,context) values ('11111111-1111-4111-8111-111111111111','renewal_reminder','renewal:sub:123','{\"periodEnd\":123}') on conflict(dedupe_key) do nothing";
    await db.exec(sql); await db.exec(sql);
    expect((await db.query('select kind from public.ttv_account_emails')).rows).toEqual([{ kind: 'renewal_reminder' }]);
    await expect(db.query("update public.ttv_account_emails set context=$1", [JSON.stringify({ large: 'x'.repeat(3000) })])).rejects.toThrow(/ttv_email_context_size/);
    await db.exec('reset role; set role authenticated');
    await expect(db.query('select * from public.ttv_account_emails')).rejects.toThrow(/permission denied/);
  } finally { await db.close(); }
});

test('every lifecycle email has readable text, a trusted account button and clear free-viewing terms', () => {
  for (const kind of ['renewal_reminder', 'payment_failed', 'membership_ending', 'membership_ended']) {
    if (!isMembershipNotice(kind)) throw new Error('Unknown notice');
    const mail = accountEmail(kind, { periodEnd: end });
    expect(mail.text).toContain('https://www.tatestv.ca/account');
    expect(mail.text).toMatch(/free/i);
    expect(mail.html).toContain('Manage membership');
    expect(mail.html).not.toContain('tracking');
    expect(mail.html).not.toContain('undefined');
    expect(mail.subject).not.toContain('Welcome to');
  }
  expect(accountEmail('welcome').subject).toContain('Welcome');
});
