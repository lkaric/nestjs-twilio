---
title: Webhook Signature Validation
description: Validate inbound Twilio webhook requests with TwilioWebhookGuard and @TwilioWebhook().
---

Twilio signs every webhook request it sends (SMS, voice, status callbacks,
...) with an `X-Twilio-Signature` header. `TwilioWebhookGuard` recomputes
that signature for the exact URL and body the guard reconstructs, and
rejects the request if it doesn't match — byte for byte, verified with the
`twilio` SDK's constant-time comparison.

## Basic usage

Apply the guard with Nest's `@UseGuards()` and mark the route with
`@TwilioWebhook()`:

```ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TwilioWebhookGuard, TwilioWebhook, TwilioWebhookRequest } from 'nestjs-twilio';

@Controller('webhooks/sms')
@UseGuards(TwilioWebhookGuard)
export class WebhookController {
  @Post()
  @TwilioWebhook()
  handleIncomingSms(@Body() body: TwilioWebhookRequest) {
    console.log('From:', body.From);
    console.log('Body:', body.Body);
  }
}
```

`@TwilioWebhook()` applies to a controller class (setting the default for
every handler) or to an individual handler method, where it overrides the
class-level options for that route only.

## Resolving the auth token

`TwilioWebhookGuard` needs an auth token to compute the expected signature.
It resolves one with the following priority, from highest to lowest:

1. The `authToken` passed to `@TwilioWebhook({ authToken: '...' })` on the
   matched handler or controller.
2. A per-request override attached by earlier middleware/guards.
3. A module-level default, injected via the `TWILIO_WEBHOOK_OPTIONS` DI
   token.

```ts
import { Module } from '@nestjs/common';
import { TwilioWebhookGuard, TWILIO_WEBHOOK_OPTIONS } from 'nestjs-twilio';

@Module({
  providers: [
    TwilioWebhookGuard,
    {
      provide: TWILIO_WEBHOOK_OPTIONS,
      useValue: { authToken: process.env.TWILIO_AUTH_TOKEN },
    },
  ],
})
export class WebhookModule {}
```

If no auth token can be resolved, the guard throws a `ForbiddenException`
before attempting validation.

## Reconstructing the signed URL

Twilio signs the exact public URL it called. `TwilioWebhookGuard`
reconstructs that URL with this priority:

1. `options.url`, if supplied via `@TwilioWebhook({ url: '...' })`.
2. `options.protocol` / `options.host`, if supplied.
3. The `X-Forwarded-Proto` and `X-Forwarded-Host` headers, for deployments
   behind a reverse proxy or load balancer.
4. The protocol and host Nest's HTTP adapter observed directly on the
   request.

```ts
@Post('sms')
@TwilioWebhook({ url: 'https://example.com/webhooks/sms' })
handleIncomingSms(@Body() body: TwilioWebhookRequest) {
  // Signature validated against the exact URL above.
}
```

Use `url` whenever a proxy rewrites the request path in a way that
`protocol`/`host` overrides can't describe.

## Form-encoded vs. JSON bodies

- **Form-encoded webhooks** (the default Twilio format) are validated with
  the SDK's `validateRequest`, using the parsed request body directly.
- **JSON webhooks**, signed by Twilio with a `bodySHA256` query parameter,
  are validated with `validateRequestWithBody` against the _raw_ request
  bytes. `TwilioWebhookGuard` automatically selects this path when the
  resolved URL contains `bodySHA256`.

For JSON webhooks, enable raw body capture when bootstrapping your
application so `request.rawBody` is populated with the exact bytes Twilio
sent:

```ts
const app = await NestFactory.create(AppModule, { rawBody: true });
```

Without `rawBody`, the guard falls back to re-serializing the parsed body,
which only produces a matching hash if the JSON serialization happens to be
byte-identical to what Twilio sent.

## Disabling validation for a route

```ts
@Post('health')
@TwilioWebhook({ disableValidation: true })
health() {
  return { ok: true };
}
```

Useful for local development or intentionally public endpoints under a
controller that otherwise requires validation.

## Reference

### `TwilioWebhookOptions`

| Field               | Type                | Description                                                        |
| ------------------- | ------------------- | ------------------------------------------------------------------ |
| `authToken`         | `string`            | Auth token used to compute the expected signature.                 |
| `url`               | `string`            | Full public URL (with query string) Twilio was configured to call. |
| `protocol`          | `'http' \| 'https'` | Overrides the reconstructed URL's protocol.                        |
| `host`              | `string`            | Overrides the reconstructed URL's host.                            |
| `disableValidation` | `boolean`           | Skips validation entirely for the decorated route/class.           |

### Exports

- `TwilioWebhookGuard` — the `CanActivate` guard.
- `TwilioWebhook(options?)` — route/class decorator setting per-route
  options.
- `TWILIO_WEBHOOK_OPTIONS` — DI token for the module-level default options,
  and the metadata key `TwilioWebhookGuard` reads via `Reflector`.
- `TwilioWebhookRequest` — the minimal request shape the guard reads
  (`protocol`, `originalUrl`, `url`, `headers`, `body`, `rawBody`).
