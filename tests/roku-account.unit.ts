import { test, expect } from '@playwright/test';
import { pbkdf2Sync } from 'node:crypto';
import { serverModule } from './server-harness';
import { defaults } from '../lib/profiles';
import { validEmail, validPassword } from '../lib/accountModel';
import { accountSecurityEmail } from '../lib/accountEmails';

const user = { id: 'owner-one', email: 'viewer@example.com', email_confirmed_at: '2026-11-15' };
const session = { access_token: 'access-token-one', refresh_token: 'refresh-token-one', expires_at: 2000000000, expires_in: 3600 };
const view = { user, member: true, ownedThemeIds: ['shaw-2006'], household: { profiles: defaults, pin: null as null | { salt: string; hash: string } }, isAdmin: true, stripe_customer_id: 'private' };
function setup() {
  let currentView = view;
  let clock = Date.now();
  const calls: { name: string; args: unknown[] }[] = [];
  const record = (name: string, response: unknown) => async (...args: unknown[]) => { calls.push({ name, args }); return typeof response === 'function' ? response(...args) : response; };
  const auth: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    signInWithPassword: record('signin', { data: { user, session }, error: null }),
    refreshSession: record('refresh', { data: { user, session }, error: null }),
    verifyOtp: record('verify', { data: { user, session }, error: null }),
    updateUser: record('update', { data: { user }, error: null }),
    signOut: record('signout', { error: null }),
    getUser: record('getUser', { data: { user }, error: null }),
  };
  const db = { rpc: record('rate', { data: true, error: null }), auth: { admin: {
    generateLink: record('generate', { data: { properties: { email_otp: '123456' } }, error: null }),
    signOut: record('revoke', { error: null }),
  } } };
  const privateJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  const accountData = { accountView: record('accountView', () => currentView) };
  const configuration = { ready: true, sender: "Tate's TV <hello@mail.tatestv.ca>" };
  const emailService = { accountEmailConfiguration: () => configuration, deliverAccountEmails: record('welcome', {}) };
  const viewing = { viewingProfiles: (v: typeof view) => v.household?.profiles ?? defaults.filter(p => !p.kids), viewingGrant: () => "verified-profile-grant" };
  const helper = serverModule('lib/server/rokuAccount.ts', {
    '@supabase/supabase-js': { createClient: () => ({ auth }) },
    './accountAuth': { accountsEnabled: () => true, accountOrigin: () => 'https://www.tatestv.ca' },
    './supabaseAdmin': { createSupabaseAdminClient: () => db },
    './accountViewing': viewing,
    './accountData': accountData, './accountEmails': emailService,
    '../accountEmails': { accountSecurityEmail },
    './requestSecurity': { getClientAddress: () => '192.0.2.1' }, './http': { privateJson }, '../profiles': { defaults },
  }, { SUPABASE_SERVICE_ROLE_KEY: 'test-signing-key', RESEND_API_KEY: 'test-mail-key' }, {
    fetch: record('email', new Response('{}', { status: 200 })),
    Date: class extends Date { static now() { return clock; } },
  });
  const route = serverModule('app/api/roku/account/route.ts', {
    'next/server': { after: (fn: () => unknown) => fn() },
    '@/lib/accountModel': { validEmail, validPassword },
    '@/lib/server/accountData': accountData,
    '@/lib/server/accountViewing': viewing,
    '@/lib/server/accountDevices': { touchAccountDevice: async () => 'verified-session' },
    '@/lib/server/serviceHealth': { recordServiceEvent: async () => {} },
    '@/lib/server/accountEmails': emailService,
    '@/lib/server/supabaseAdmin': { createSupabaseAdminClient: () => db },
    '@/lib/server/http': { privateJson, readBoundedJson: async (req: Request) => req.json() },
    '@/lib/server/rokuAccount': helper,
  });
  const request = (body: unknown, token?: string, origin?: string) => route.POST!(new Request('https://www.tatestv.ca/api/roku/account', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
  }));
  return { request, auth, helper, db, calls, configuration,
    advance: (seconds: number) => { clock += seconds * 1000; },
    account: (value: typeof view) => { currentView = value; } };
}

test('native sign-in accepts the website identity without cookies or caller-supplied user IDs', async () => {
  const h = setup();
  const res = await h.request({ action: 'signin', email: ' VIEWER@example.com ', password: 'existing-password', userId: 'someone-else' });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, session: { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at } });
  expect(h.calls.find(c => c.name === 'signin')?.args).toEqual([{ email: user.email, password: 'existing-password' }]);
  expect(res.headers.get('set-cookie')).toBeNull();
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(h.calls.filter(c => c.name === 'rate').every(c => !JSON.stringify(c).includes(user.email))).toBe(true);
});

test('cross-site requests and rate-limit failures never reach authentication', async () => {
  const h = setup();
  expect((await h.request({ action: 'signin' }, undefined, 'https://evil.example')).status).toBe(403);
  h.db.rpc = async () => ({ data: false, error: null });
  expect((await h.request({ action: 'signin' })).status).toBe(429);
  expect(h.calls.some(c => c.name === 'signin')).toBe(false);
});

test('signup requires adulthood, sends a branded code, and does not return it to the TV', async () => {
  const h = setup();
  expect((await h.request({ action: 'signup', email: user.email, password: 'a-long-password' })).status).toBe(400);
  const res = await h.request({ action: 'signup', email: user.email, password: 'a-long-password', adult: true });
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(JSON.stringify(body)).not.toContain('123456');
  expect(h.helper.readChallenge!(body.challenge).purpose).toBe('signup');
  const email = JSON.parse(String((h.calls.find(c => c.name === 'email')!.args[1] as RequestInit).body));
  expect(email.to).toEqual([user.email]);
  expect(email.text).toContain('123456');
  expect(email.html).toContain("Welcome to Tate's TV");
  expect(h.calls.some(c => c.name === 'signin')).toBe(false);
});

test('expired, forged and wrong-purpose email challenges cannot reset a password', async () => {
  const h = setup();
  const challenge = h.helper.issueChallenge!(user.email, 'signup');
  expect((await h.request({ action: 'reset', challenge, code: '123456', password: 'changed-password' })).status).toBe(400);
  expect(h.helper.readChallenge!(challenge + 'x')).toBeNull();
  expect((await h.request({ action: 'verify', challenge: 'forged', code: '123456' })).status).toBe(400);
  h.advance(601);
  expect(h.helper.readChallenge!(challenge)).toBeNull();
  expect((await h.request({ action: 'verify', challenge, code: '123456' })).status).toBe(400);
  expect(h.calls.some(c => c.name === 'verify' || c.name === 'update')).toBe(false);
});

test('recovery verifies its email code before changing the shared password and revoking other sessions', async () => {
  const h = setup();
  const challenge = h.helper.issueChallenge!(user.email, 'recovery');
  expect((await h.request({ action: 'reset', challenge, code: '123456', password: 'changed-password' })).status).toBe(200);
  expect(h.calls.filter(c => ['verify', 'update', 'signout'].includes(c.name))).toEqual([
    { name: 'verify', args: [{ email: user.email, token: '123456', type: 'recovery' }] },
    { name: 'update', args: [{ password: 'changed-password' }] },
    { name: 'signout', args: [{ scope: 'others' }] },
  ]);
});

test('refresh returns rotation independently of account loading and only clears invalid provider sessions', async () => {
  const h = setup();
  expect((await h.request({ action: 'refresh', refreshToken: session.refresh_token })).status).toBe(200);
  expect(h.calls.some(c => c.name === 'accountView')).toBe(false);
  h.auth.refreshSession = async () => ({ data: {}, error: { status: 503 } });
  expect((await h.request({ action: 'refresh', refreshToken: session.refresh_token })).status).toBe(503);
  h.auth.refreshSession = async () => ({ data: {}, error: { status: 400 } });
  expect((await h.request({ action: 'refresh', refreshToken: session.refresh_token })).status).toBe(401);
});

test('account responses omit PIN hashes and internal entitlements; profile access uses the authenticated household', async () => {
  const h = setup();
  expect((await h.request({ action: 'state', userId: 'someone-else' })).status).toBe(401);
  const res = await h.request({ action: 'state', userId: 'someone-else' }, session.access_token);
  const body = await res.json();
  expect(body.account.user.id).toBe(user.id);
  expect(body.account.member).toBe(true);
  expect(body.account.isAdmin).toBeUndefined();
  expect(body.account.household).toBeUndefined();
  expect(body.account.stripe_customer_id).toBeUndefined();
  expect((await h.request({ action: 'profile', profileId: 'other-household' }, session.access_token)).status).toBe(404);
  expect((h.calls.find(c => c.name === 'accountView')?.args[0] as { id: string }).id).toBe(user.id);
});

test('website parent PIN uses the same PBKDF2 derivation and is never returned in the device projection', async () => {
  const h = setup();
  const salt = '12'.repeat(16);
  const secured = { ...view, household: { ...view.household, pin: { salt, hash: pbkdf2Sync('123456', Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex') } } };
  expect(await h.helper.parentPinMatches!(secured, '123456')).toBe(true);
  expect(await h.helper.parentPinMatches!(secured, '654321')).toBe(false);
  expect(await h.helper.parentPinMatches!(secured, 123456)).toBe(false);
  const projection = h.helper.deviceAccount!(secured);
  expect(projection.parentPinRequired).toBe(true);
  expect(JSON.stringify(projection)).not.toContain(salt);
});

test('sign-out revokes this device session only', async () => {
  const h = setup();
  expect((await h.request({ action: 'signout' }, session.access_token)).status).toBe(200);
  expect(h.calls.find(c => c.name === 'revoke')?.args).toEqual([session.access_token, 'local']);
});

test('adult profile selection verifies the shared parent PIN; children cannot choose another household', async () => {
  const h = setup();
  const salt = '34'.repeat(16);
  h.account({ ...view, household: { ...view.household, pin: { salt, hash: pbkdf2Sync('1234', Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex') } } });
  const adult = defaults.find(profile => !profile.kids)!;
  const child = defaults.find(profile => profile.kids)!;
  expect((await h.request({ action: 'profile', profileId: adult.id }, session.access_token)).status).toBe(403);
  expect((await h.request({ action: 'profile', profileId: adult.id, pin: '9999' }, session.access_token)).status).toBe(403);
  expect((await h.request({ action: 'profile', profileId: adult.id, pin: '1234' }, session.access_token)).status).toBe(200);
  expect((await h.request({ action: 'profile', profileId: child.id }, session.access_token)).status).toBe(200);
});
