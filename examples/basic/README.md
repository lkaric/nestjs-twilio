# nestjs-twilio — basic example

A runnable NestJS application exercising every feature this package ships:
client injection, named multi-account clients, webhook signature validation,
TwiML responses and Twilio-to-HTTP error mapping.

It consumes the library through a pnpm workspace link, so it compiles and runs
against the **built output** in `dist/` — not the TypeScript sources. That makes
it a genuine check of the published surface.

## Run it

From the repository root:

```bash
pnpm install
pnpm build                                  # the library must be built first
pnpm --filter @nestjs-twilio/example-basic build
cd examples/basic
cp .env.example .env                        # then fill in your credentials
node dist/main.js
```

The app listens on `http://localhost:3000` (override with `PORT`).

It boots with placeholder credentials, so you can explore the routes without a
Twilio account — only the endpoints that actually call the API need real ones.

## What each route demonstrates

| Route                    | Demonstrates                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `GET /sms/accounts`      | Two independently credentialed clients resolved side by side — `forRoot()` and `forFeature('billing')`           |
| `POST /sms`              | Sending a message through the injected client, with `TwilioExceptionFilter` mapping SDK errors to HTTP responses |
| `POST /webhooks/sms`     | Signature validation plus a TwiML reply                                                                          |
| `POST /webhooks/voice`   | Same, with the response content type overridden per route                                                        |
| `POST /webhooks/billing` | Validation against a subaccount's auth token                                                                     |

## Trying the webhook routes

Requests without a valid `X-Twilio-Signature` are rejected with `403`:

```bash
curl -i -X POST http://localhost:3000/webhooks/sms \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'From=%2B15550009999&Body=hello'
# HTTP/1.1 403 Forbidden
```

To exercise the success path, compute the signature the way Twilio does — the
URL, then every POST parameter appended in alphabetical order, signed with your
auth token:

```bash
node -e "
const crypto = require('crypto');
const url = 'http://localhost:3000/webhooks/sms';
const params = { From: '+15550009999', To: '+15550001111', Body: 'hello', MessageSid: 'SM123' };
let payload = url;
for (const key of Object.keys(params).sort()) payload += key + params[key];
console.log(crypto.createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
  .update(Buffer.from(payload, 'utf-8')).digest('base64'));
"
```

Pass the result as `X-Twilio-Signature` and the route returns TwiML with
`Content-Type: text/xml`.

In real use you would point a tunnel (`cloudflared`, `ngrok`) at the app and set
`PUBLIC_URL`, so the guard reconstructs the URL Twilio actually signed rather
than the internal one.

## Notes

- `NestFactory.create(AppModule, { rawBody: true })` is required for JSON
  webhooks. Twilio signs those with a `bodySHA256` query parameter, and the
  guard needs the exact bytes received — a re-serialized body will not match.
- `@TwilioWebhook()` binds the guard by itself. There is no separate
  `@UseGuards()` to remember.
