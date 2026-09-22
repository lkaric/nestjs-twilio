# Security Policy

## Supported versions

| Version | Supported           |
| ------- | ------------------- |
| 5.x     | ✅                  |
| 4.x     | Security fixes only |
| < 4     | ❌                  |

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it through [GitHub Security Advisories](https://github.com/lkaric/nestjs-twilio/security/advisories/new),
which keeps the report private until a fix is published. If that is
unavailable to you, email <lazar@mm.st>.

Please include a minimal reproduction, the affected version, and the impact you
believe it has. You can expect an initial response within 7 days.

## Scope

This package brokers credentials and verifies request authenticity, so the
security-relevant surface is narrow and specific:

- **`TwilioWebhookGuard`**: any way to make signature validation pass for a
  request Twilio did not sign. This includes header spoofing through
  `X-Forwarded-Proto` / `X-Forwarded-Host`, body-hash mismatches on JSON
  payloads, and non-constant-time comparison.
- **Credential handling**: any path that writes an `authToken`, `apiSecret`
  or API key into a log line, an error message, or a thrown exception. Module
  options validation is deliberately written to name the offending _field_
  without echoing its value.
- **Supply chain**: the published tarball's contents and provenance
  attestation.

Out of scope: vulnerabilities in the `twilio` SDK itself (report those to
[Twilio](https://www.twilio.com/docs/usage/security)), and anything requiring
an attacker to already control your application's configuration or process.

## Reporting a webhook bypass

If you believe you can bypass signature validation, include the exact request:
method, full URL as the server observed it, every header, and the raw body.
The reconstruction of the signed URL is the subtle part, and those details are
usually what makes a report reproducible.

## Handling your own credentials

Never paste a real Account SID, auth token or API key into an issue, a pull
request, or a discussion. Regenerate any credential that has been exposed, from
the [Twilio Console](https://console.twilio.com).
