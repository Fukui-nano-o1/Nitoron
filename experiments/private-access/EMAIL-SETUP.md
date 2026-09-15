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
4. Return to the hook dialog and click Create. Keep the Email provider enabled.
   Send Email Hook replaces SMTP delivery; leave the previous SMTP settings intact
   but do not disable the hook as a delivery workaround: the previous route does
   not enforce this hook's recipient restriction.
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

`node --test tests/private-email-hook.test.js`: 10/10 passed using the actual
Standard Webhooks verifier and independently generated HMAC fixtures. Delivery
is mocked; no real email was sent. Original function v1 bundle SHA256:
`f2f41121c34690c0546113f05424745ffbab70c6bd736203c9ac1f6b8bf89590`.

## Delivery diagnosis (2026-09-16 JST)

The owner reported an IP approval email, approved the address, and still did not
receive a login code. Read-only checks confirmed the owner is email-confirmed,
not anonymous/banned/deleted, and function v3 still contained the original code.
No owner audit entries were returned after 2026-09-15T17:00Z. These facts do not
identify the current delivery error. The connection cannot read Auth/Edge runtime
logs or Brevo delivery logs; a direct HTTP probe timed out before reaching Supabase.

Supabase Edge Functions do not have static or stable egress IPs. Approval of a
single source IP therefore does not guarantee subsequent sends. Do not turn off
Brevo's account-wide IP protections for a shared account containing Chitose-bank.
Do not diagnose an IP block solely from an HTTP 401 response.

The hook now emits only fixed diagnostic codes and numeric HTTP statuses. No
payloads, OTPs, user identities, keys, IPs, provider text or message IDs are logged.
Diagnostics also appear in the hook's error response, subject to Auth's presentation.

| Code | Meaning |
| --- | --- |
| `HOOK_CONFIG` | One or both delivery secrets are missing. |
| `HOOK_SIGNATURE` | Signature validation failed. |
| `HOOK_ACCOUNT` | Account or login action is outside the allowlist. |
| `HOOK_CODE` | Invalid OTP format. |
| `BREVO_IP_BLOCKED` | Brevo explicitly described an unrecognized/unauthorized IP with HTTP 401/403. |
| `BREVO_REJECTED` | Provider refused the request; `providerStatus` records the HTTP status. |
| `BREVO_TIMEOUT` | The delivery request timed out. |
| `BREVO_CONNECTION` | The request/response could not be completed. |
| `BREVO_RESPONSE` | No provider acceptance ID was present. |
| `BREVO_ACCEPTED` | Brevo accepted the request; this does not prove inbox delivery. |

Request one owner login code, then inspect the corresponding function invocation
and `private_login_email` log. If accepted but not received, inspect Brevo's
transactional delivery log next. Do not remove the recipient or signature checks.

## Browser error visibility follow-up (2026-09-16 JST)

The owner's 02:39/02:40 screenshots show a generic send error and Edge logs whose
newest displayed entry is 02:14:29, despite a reported request at 02:38. This does
not prove whether the request reached the hook; log refresh/filter/ingestion and
Auth rejection before hook execution remain distinct possibilities.

Code inspection found `sendPrivateLogin` discarded every Auth error and displayed
the same retry message. The prior hook-only change did not fix this. The browser
now displays an allowlisted diagnostic code plus HTTP status, without echoing raw
provider messages, keys, OTPs, URLs or identities. No automatic resend is added.

The installed auth-js also drops `code` for 5xx responses while keeping status and
message. A narrow fetch wrapper preserves known codes in the error message only
for POST /auth/v1/otp on the configured Supabase origin. Request payload, headers,
target, status and authorization are unchanged; other responses are passed through.

The browser verification now checks four actual SDK-to-UI failures: Auth 429,
OTP disabled, hook timeout, and explicit Brevo IP rejection. All 24 browser checks
pass with mocked Auth/data and no real emails. The user's real 02:38 failure is
not yet identified. Use a newly built deployment's Visit link and share the code
displayed after a single send; if there is only an unknown 5xx code, inspect the
corresponding Auth log as well as the function's Invocations tab.

References checked 2026-09-16 JST:

- https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- https://supabase.com/docs/guides/functions/secrets
- https://developers.brevo.com/docs/api-key-authentication
- https://developers.brevo.com/docs/send-a-transactional-email
- https://developers.brevo.com/docs/ip-security
- https://supabase.com/docs/guides/troubleshooting/why-supabase-edge-functions-cannot-provide-static-egress-ips-for-whitelisting-3d78b0
- https://supabase.com/docs/guides/auth/debugging/error-codes
- https://supabase.com/docs/guides/auth/rate-limits

The September 14 Nitoron SMTP screenshot identified Brevo (`smtp-relay.brevo.com`).
The current provider account and sender delivery status cannot be inspected with
the available connection. Chitose-bank and its settings are not part of this change.
