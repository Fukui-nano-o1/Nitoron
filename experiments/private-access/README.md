# Nitoron private access

Scope: Nitoron only. Allowed account: `9e4163dc-56d3-4eba-9187-6534ecc8d607`
with confirmed email `t5fki6643qty@gmail.com`. Existing records and local caches
are retained. Chitose-bank is outside this change.

## Verification

- `npm test`: 204/204 passed, including the database guard tests.
- `npm run build`: passed.
- `node experiments/private-access/check-browser.mjs`: 20/20 passed.
  Auth and data are mocked; no real login email was sent. The script checks 14
  unauthenticated routes, wrong-email rejection, owner login, cache forgery,
  token refresh with an open dialog, and logout with local records retained.
- Browser runtime dependencies are supplied through `PLAYWRIGHT_MODULE` and
  `CHROMIUM_PATH`; the defaults match the verification environment.

## Email delivery limitation

The UI rejects other addresses and requests `shouldCreateUser: false`.
This does **not** prevent someone calling Supabase Auth directly. Server-side
outbound email restriction requires a configured Send Email Hook. The hook
replaces the existing delivery path, so approved mail also needs a delivery
implementation and credentials. The connected tools cannot change Auth Hook
configuration or delivery secrets. No hook is claimed to be enabled.

Update 2026-09-16 JST: the signed, fixed-recipient Brevo Edge Function is deployed
and its 7 focused tests pass. Follow [EMAIL-SETUP.md](./EMAIL-SETUP.md) to register
the two secrets and connect it to Auth. The remaining limitation persists until
that setup and the owner's delivery check succeed.

Do not try to enforce outbound email with `banned_until` or by rejecting an
`auth.users` token update: the inspected Auth mail path sends the message before
updating its token columns, and MagicLink/Recover do not check the ban first.

- [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
- [Nitoron Auth Hooks settings](https://supabase.com/dashboard/project/ycvbjzlqrxnwalhhgzat/auth/hooks)
- [Auth email implementation](https://github.com/supabase/auth/blob/master/internal/api/mail.go)

## Hosting protection

The owner reports Vercel Authentication / All Deployments saved for the three
Nitoron projects. The Vercel connector returned 403 for independent project
inspection, so this setting is owner-reported rather than independently verified.
Application authentication and database access restrictions are additional layers.

## Applied database restriction

Migration `nitoron_private_access` was applied to `ycvbjzlqrxnwalhhgzat`.
Eleven restrictive policies cover the ten current public tables and
`storage.objects`; previous ownership policies remain in place. The PostgREST
pre-request rejects unauthorized roles before executing REST queries or RPCs.
The existing `nitoron-files` bucket remains private. Already-issued signed URLs
can last until their expiry (the current app requests 60-second URLs).

Real database role checks: anonymous and a different existing account see zero
publications and fail the pre-request; the verified owner still sees all 14
published catalog entries. All 18 notes and 17 publication rows retained the same
content digests. These are database role tests; direct external HTTP probing timed
out in the verification environment and is not claimed as an end-to-end API test.

New application tables must receive the same restrictive policy. Removing the
restriction later requires an explicit migration; do not remove only the UI gate.
