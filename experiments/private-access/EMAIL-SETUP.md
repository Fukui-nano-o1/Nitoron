# Nitoron private login email setup

Prepared 2026-09-16 JST. Project: `ycvbjzlqrxnwalhhgzat` only.
The Edge Function is deployed, but connecting it to Auth and registering delivery
secrets require dashboard access. Existing SMTP has not been changed.

Function URL:
`https://ycvbjzlqrxnwalhhgzat.supabase.co/functions/v1/nitoron-private-email`

## Dashboard steps

1. Brevo → SMTP & API → API keys → Generate a new API key. Name it
   `nitoron-private-login`. This must be an API key, not the SMTP password.
   Retain the existing verified sender `t5fki6643qty@gmail.com`.
2. In [Nitoron Auth Hooks](https://supabase.com/dashboard/project/ycvbjzlqrxnwalhhgzat/auth/hooks),
   add a Send Email hook, select HTTPS, and paste the function URL. Generate its
   signing secret. Keep this dialog open; do not enable/save the hook yet.
3. In another tab, open
   [Nitoron Edge Function Secrets](https://supabase.com/dashboard/project/ycvbjzlqrxnwalhhgzat/functions/secrets).
   Save `BREVO_API_KEY` with the value from step 1 and `SEND_EMAIL_HOOK_SECRET`
   with the complete `v1,whsec_...` value from step 2. Enter secrets directly in
   the dashboard, not in chat or Git. These variable names match the deployed code.
4. Return to the hook dialog and create/enable it. Keep the Email provider enabled.
   Send Email Hook replaces SMTP delivery; leave the previous SMTP settings intact
   so disabling the hook can restore the previous route if delivery fails.
5. From Nitoron, request one login email to the owner's account. Check that the code
   arrives and works. Actual delivery remains unverified until this step succeeds.
   Do not send tests to another person's address. Rejection tests use signed mocks.

## Behavior

The hook accepts only signed `magiclink` events for confirmed-owner account ID
`9e4163dc-56d3-4eba-9187-6534ecc8d607` and matching email. Delivery is always addressed
to the literal `t5fki6643qty@gmail.com`, with sender name `Nitoron`. Any `new_email`
or signup/invite/recovery/email-change/other event is rejected. Only the login code
is sent. Account verification and data authorization remain the application's
separate responsibilities.

Gateway JWT verification is disabled because Supabase Auth signs this webhook
with Standard Webhooks HMAC. Missing secrets, absent/invalid/expired signatures,
wrong identity, invalid code, and provider failures all fail closed. Request bodies,
codes, keys and provider response details are not logged or returned.

`node --test tests/private-email-hook.test.js`: 7/7 passed using the actual
Standard Webhooks verifier and independently generated HMAC fixtures. Delivery
is mocked; no real email was sent. Deployed function v1 bundle SHA256:
`f2f41121c34690c0546113f05424745ffbab70c6bd736203c9ac1f6b8bf89590`.

References checked 2026-09-16 JST:

- https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- https://supabase.com/docs/guides/functions/secrets
- https://developers.brevo.com/docs/api-key-authentication
- https://developers.brevo.com/docs/send-a-transactional-email

The September 14 Nitoron SMTP screenshot identified Brevo (`smtp-relay.brevo.com`).
The current provider account and sender delivery status cannot be inspected with
the available connection. Chitose-bank and its settings are not part of this change.
