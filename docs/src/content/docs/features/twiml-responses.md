---
title: Return TwiML responses
description: Return VoiceResponse, MessagingResponse, and FaxResponse builders directly from controllers with TwimlInterceptor.
---

Twilio's voice, messaging, and fax webhooks expect an XML (TwiML) response.
`TwimlInterceptor` lets a controller handler return a `twilio` SDK TwiML
builder instance directly. The interceptor serializes it to XML and sets
the `Content-Type` header for you.

## Basic usage

```ts title="src/sms/sms.controller.ts"
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { TwimlInterceptor } from 'nestjs-twilio';
import { MessagingResponse } from 'twilio/lib/twiml/MessagingResponse';

@Controller('sms')
export class SmsController {
  @Post('reply')
  @UseInterceptors(TwimlInterceptor)
  async replySms() {
    const response = new MessagingResponse();
    response.message('Hello, thanks for texting!');
    return response; // serialized to XML with Content-Type: text/xml
  }
}
```

This works the same way for `VoiceResponse` and `FaxResponse` builders from
the `twilio` SDK. `TwimlInterceptor` recognizes any TwiML builder instance
via `value instanceof TwiML` and passes non-TwiML return values through
unchanged.

```ts
import { VoiceResponse } from 'twilio/lib/twiml/VoiceResponse';

@Post('voice')
@UseInterceptors(TwimlInterceptor)
answerCall() {
  const twiml = new VoiceResponse();
  twiml.say('Thanks for calling.');
  return twiml;
}
```

## Content-Type

By default, `TwimlInterceptor` sets `Content-Type: text/xml`. Pass a
constructor option to change the default for every route using that
instance:

```ts
@UseInterceptors(new TwimlInterceptor({ contentType: 'application/xml' }))
```

`contentType` accepts `'text/xml'` or `'application/xml'`.

### Per-route override

Use the `@TwimlResponseType()` decorator to override the `Content-Type` for
a single handler, regardless of the interceptor's constructor option:

```ts
import { UseInterceptors } from '@nestjs/common';
import { TwimlInterceptor, TwimlResponseType } from 'nestjs-twilio';

@Post('reply')
@UseInterceptors(TwimlInterceptor)
@TwimlResponseType('application/xml')
replySms() {
  // ...
}
```

## How it works

`TwimlInterceptor` only acts on HTTP responses (`context.getType() ===
'http'`) whose handler returned a TwiML builder instance. For every other
return value, it passes the data through untouched, so it is safe to apply
globally alongside handlers that return plain JSON.

## Reference

See [`TwimlInterceptorOptions`](/api/interfaces/twimlinterceptoroptions/)
for the interceptor's constructor options,
[`TwimlInterceptor`](/api/classes/twimlinterceptor/) for the interceptor
itself, [`TwimlResponseType`](/api/functions/twimlresponsetype/) for the
per-route decorator, and [`isTwimlResponse`](/api/functions/istwimlresponse/)
for the type guard.
