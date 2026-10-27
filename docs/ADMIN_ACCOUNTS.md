# Separate staff accounts

The `/admin` login uses a named Supabase email/password account. Parent sessions,
profile names, membership purchases and editable user metadata never grant admin
permissions. Every existing protected admin API verifies the admin identity with
Supabase Auth and checks its ID against the server-only `TTV_ADMIN_USER_IDS` list.
There is no public admin registration endpoint and no old shared-password fallback.

## Provision before deploying

1. In the Tate’s TV Supabase project, open Authentication → Users → Add user.
   Create a dedicated staff user with an email address you control and a unique
   strong password. Verify ownership of this inbox; only mark it confirmed if
   ownership has actually been established. Do not share the password in chat.
   Use a different email from the everyday parent account.
2. Copy that user's UUID from the Users page.
3. In Vercel → retro-tv → Settings → Environment Variables, set server-only
   `TTV_ADMIN_USER_IDS` to that UUID. It accepts comma-separated UUIDs for additional
   staff. Never prefix it with `NEXT_PUBLIC_`.
4. Keep `TTV_ACCOUNTS_ENABLED=true`, `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured.
   The account rate-limit migration must already be installed.
5. Deploy the reviewed branch after CI passes. Visit `https://www.tatestv.ca/admin`
   and sign in using the dedicated staff credentials.
6. Verify that normal parent credentials cannot open admin tools, signing out of
   admin leaves parent viewing signed in, and admin requests return 401 after
   admin logout. Check programming reads without modifying published content.
7. Once the release is accepted, remove obsolete `ADMIN_PASSWORD`. Old admin
   cookies no longer grant access. Keep `ADMIN_SESSION_SECRET`: despite its legacy
   name, viewer analytics still uses it to sign its separate telemetry session.

Removing an ID from `TTV_ADMIN_USER_IDS` and redeploying revokes its admin access.
A missing list or unavailable Auth service denies access. Keep Supabase and Vercel
owner access as the recovery path; password resets can be managed from Supabase
Auth. Do not temporarily restore the shared password to work around setup issues.

## Session behavior

Admin Auth uses a dedicated HttpOnly, Secure (production), SameSite=Strict cookie
name. Household cookies are neither read nor cleared by admin sign-in/sign-out.
The browser cookie has an eight-hour rolling lifetime; active refresh can extend
it. This is not an absolute eight-hour session timeout. This release implements
email/password authentication, not an MFA enrollment/challenge flow.

## Verification

Regression tests cover nonstaff rejection, unconfirmed users, provider outages,
legacy/parent-cookie isolation, clearing rejected credentials, rate-limit guard
results, logout isolation and cross-origin rejection. Browser/provider integration
and live staff login still require CI and the provisioned account.
