---
title: Validate webhook signatures
description: Validate inbound Twilio webhook requests with TwilioWebhookGuard and @TwilioWebhook().
---

Twilio signs every webhook request it sends (SMS, voice, status callbacks,
...) with an `X-Twilio-Signature` header. `TwilioWebhookGuard` recomputes
that signature for the exact URL and body the guard reconstructs, and
rejects the request if it doesn't match. The comparison is byte for byte,
using the `twilio` SDK's constant-time comparison.

## Basic usage

`@TwilioWebhook()` is all you need: it binds the guard and records the
route's options in one step:

```ts title="src/webhooks/webhook.controller.ts"
import { Body, Controller, Post } from '@nestjs/common';
import { TwilioWebhook, TwilioWebhookRequest } from 'nestjs-twilio';

@Controller('webhooks/sms')
export class WebhookController {
  @Post()
  @TwilioWebhook()
  handleIncomingSms(@Body() body: TwilioWebhookRequest) {
    // Reached only if the Twilio signature verified.
    console.log('From:', body.From);
    console.log('Body:', body.Body);
  }
}
```

:::caution[Do not use the decorator for options only]
There is deliberately no way to record webhook options without also enabling
the guard. An earlier design exposed `@TwilioWebhook()` as a metadata-only
decorator that required a separate `@UseGuards(TwilioWebhookGuard)`; forgetting
the second decorator left the route completely unvalidated while looking
protected.
:::

You can still reference `TwilioWebhookGuard` directly (for example to register
it globally with `APP_GUARD`), but you do not need to pair it with the
decorator.

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

```ts title="src/webhooks/webhook.module.ts"
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

## Typed request bodies

Interfaces for the bodies Twilio posts are exported from the package root, so
handlers can be typed without hand-declaring the shape.

```ts
import {
  TwilioWebhook,
  TwimlInterceptor,
  type TwilioIncomingMessagePayload,
} from 'nestjs-twilio';

@Post('webhooks/sms')
@TwilioWebhook()
@UseInterceptors(TwimlInterceptor)
handleSms(@Body() payload: TwilioIncomingMessagePayload) {
  const reply = new twilio.twiml.MessagingResponse();
  reply.message(`Thanks, ${payload.ProfileName ?? payload.From}`);
  return reply;
}
```

| Type                           | Body it describes                                             |
| ------------------------------ | ------------------------------------------------------------- |
| `TwilioIncomingMessagePayload` | An inbound SMS, MMS, RCS or WhatsApp message                  |
| `TwilioMessageStatusPayload`   | A message `StatusCallback` as an outbound message progresses  |
| `TwilioIncomingCallPayload`    | An inbound voice call, and any TwiML `action` callback        |
| `TwilioCallStatusPayload`      | A call `StatusCallback`, adding duration and recording fields |

The supporting unions `TwilioMessageStatus`, `TwilioCallStatus` and
`TwilioCallDirection` constrain the status fields to the values Twilio
documents, so a typo in a comparison is a compile error.

:::caution[Every value is a string]
Twilio posts `application/x-www-form-urlencoded`, so **numbers and booleans
arrive as strings**: `NumMedia` is `'2'`, not `2`, and `Forwarded` is
`'true'`. These interfaces model that faithfully rather than pretending
otherwise. Convert at the point of use.

```ts
const count = Number(payload.NumMedia ?? 0);

for (let index = 0; index < count; index += 1) {
  const url = payload[`MediaUrl${index}`];
  const contentType = payload[`MediaContentType${index}`];
}
```

:::

Twilio states that it may add parameters without notice, so treat these as the
documented subset rather than an exhaustive list. Signature validation covers
the entire body whatever it contains, so a new parameter never breaks
verification.

## Reference

See [`TwilioWebhookOptions`](/api/interfaces/twiliowebhookoptions/) for the
full set of per-route options, [`TwilioWebhookGuard`](/api/classes/twiliowebhookguard/)
for the guard itself, [`TwilioWebhook`](/api/functions/twiliowebhook/) for
the decorator, and [`TwilioWebhookRequest`](/api/interfaces/twiliowebhookrequest/)
for the request shape the guard reads.
