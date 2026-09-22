---
title: Testing
description: Test services and controllers that inject a Twilio client, without calling the real Twilio API.
---

`nestjs-twilio` registers the Twilio client as a normal Nest provider, so testing it means overriding a provider, the same as any other dependency. The examples below use Vitest (`vi.fn()`, `describe`, `it`, `expect`), which is what this repository uses, but every pattern applies equally to Jest: substitute `jest.fn()` for `vi.fn()` and the rest is unchanged.

## Overriding the injected client

`getTwilioClientToken()` returns the exact DI token `TwilioModule` registers the client under. It is exported precisely so tests (and any other consumer that needs the raw token, such as a custom provider) can target the same token and swap in a stub, instead of guessing an internal string or symbol.

```ts title="src/sms/sms.service.ts"
import { Injectable } from '@nestjs/common';
import { InjectTwilio } from 'nestjs-twilio';

import type { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  constructor(@InjectTwilio() private readonly client: Twilio) {}

  send(to: string, body: string) {
    return this.client.messages.create({ to, body, from: '+15557654321' });
  }
}
```

```ts title="src/sms/sms.service.spec.ts"
import { Test } from '@nestjs/testing';
import { getTwilioClientToken, TwilioModule } from 'nestjs-twilio';
import { describe, expect, it, vi } from 'vitest';

import { SmsService } from './sms.service';

import type { Twilio } from 'twilio';

describe('SmsService', () => {
  it('sends a message through the injected client', async () => {
    const create = vi.fn().mockResolvedValue({ sid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' });
    const clientStub = { messages: { create } } as unknown as Twilio;

    const moduleRef = await Test.createTestingModule({
      imports: [
        TwilioModule.forRoot({ accountSid: `AC${'x'.repeat(32)}`, authToken: 'test_token' }),
      ],
      providers: [SmsService],
    })
      .overrideProvider(getTwilioClientToken())
      .useValue(clientStub)
      .compile();

    const service = moduleRef.get(SmsService);
    await service.send('+15551234567', 'Hello');

    expect(create).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Hello',
      from: '+15557654321',
    });

    await moduleRef.close();
  });
});
```

`TwilioModule.forRoot()` still runs, so its option validation, its `TWILIO_WEBHOOK_OPTIONS` provider and everything else it wires up stay in place. Only the client itself is replaced, which keeps the test close to the real module graph instead of hand-assembling one.

## Overriding a named client

A client registered with `TwilioModule.registerClient({ name, ... })` sits behind `getTwilioClientToken(name)`. Pass the same name to override it:

```ts title="src/billing/billing.service.spec.ts"
import { Test } from '@nestjs/testing';
import { getTwilioClientToken, InjectTwilio, TwilioModule } from 'nestjs-twilio';
import { Injectable } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { Twilio } from 'twilio';

@Injectable()
class BillingService {
  constructor(@InjectTwilio('billing') private readonly client: Twilio) {}

  charge(to: string) {
    return this.client.messages.create({ to, body: 'Invoice', from: '+15557654321' });
  }
}

describe('BillingService', () => {
  it('sends through the named billing client', async () => {
    const create = vi.fn().mockResolvedValue({ sid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' });
    const billingClientStub = { messages: { create } } as unknown as Twilio;

    const moduleRef = await Test.createTestingModule({
      imports: [
        TwilioModule.forRoot({ accountSid: `AC${'x'.repeat(32)}`, authToken: 'root_token' }),
        TwilioModule.registerClient({
          name: 'billing',
          accountSid: `AC${'y'.repeat(32)}`,
          authToken: 'billing_token',
        }),
      ],
      providers: [BillingService],
    })
      .overrideProvider(getTwilioClientToken('billing'))
      .useValue(billingClientStub)
      .compile();

    await moduleRef.get(BillingService).charge('+15551234567');

    expect(create).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Invoice',
      from: '+15557654321',
    });

    await moduleRef.close();
  });
});
```

`getTwilioClientToken()` and `getTwilioClientToken('billing')` are different symbols, so overriding one never touches the other. A module with several named clients only needs a stub for the ones the code under test actually calls.

## Testing a controller behind the webhook guard

This is the hard case: `TwilioWebhookGuard` runs before your handler and rejects any request whose `X-Twilio-Signature` header does not match a signature it computes itself from the auth token, the exact webhook URL, and the request body. A request built without a valid header never reaches the controller.

`@TwilioWebhook({ disableValidation: true })` exists, but only for local development where you cannot easily receive a real Twilio callback. Using it in tests defeats the point: it skips the guard entirely, so the test stops exercising the one thing that matters, the signature check itself.

Compute a real signature instead, with the same `twilio` SDK function the guard calls internally, `getExpectedTwilioSignature(authToken, url, params)`:

```ts title="src/webhooks/webhook.controller.ts"
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { TwilioWebhook } from 'nestjs-twilio';

@Controller('webhooks/sms')
export class WebhookController {
  @Post()
  @HttpCode(200)
  @TwilioWebhook()
  handleIncomingSms(@Body() body: Record<string, string>) {
    return { from: body.From, receivedBody: body.Body };
  }
}
```

```ts title="src/webhooks/webhook.controller.spec.ts"
import { Test } from '@nestjs/testing';
import { TwilioModule } from 'nestjs-twilio';
import twilio from 'twilio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { WebhookController } from './webhook.controller';

import type { INestApplication } from '@nestjs/common';

const AUTH_TOKEN = 'test_auth_token';
// options.url pins the exact URL the guard signs against, so the test can
// listen on any local port without the reconstructed URL having to match it.
const WEBHOOK_URL = 'https://example.com/webhooks/sms';

describe('WebhookController', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TwilioModule.forRoot({
          accountSid: `AC${'x'.repeat(32)}`,
          authToken: AUTH_TOKEN,
          webhookUrl: WEBHOOK_URL,
        }),
      ],
      controllers: [WebhookController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const { port } = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a request signed with the correct signature', async () => {
    const body = { From: '+15551234567', Body: 'Hello' };
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, WEBHOOK_URL, body);

    const response = await fetch(`${baseUrl}/webhooks/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': signature,
      },
      body: new URLSearchParams(body).toString(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ from: body.From, receivedBody: body.Body });
  });

  it('rejects a request with a forged signature', async () => {
    const body = { From: '+15551234567', Body: 'Hello' };

    const response = await fetch(`${baseUrl}/webhooks/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'forged',
      },
      body: new URLSearchParams(body).toString(),
    });

    expect(response.status).toBe(403);
  });
});
```

`webhookUrl` on `forRoot()` sets the module-wide default the guard falls back to (see [Register the module](/configuration/)), so `@TwilioWebhook()` needs no per-route options here. Setting `authToken` on `forRoot()` is enough for the guard too, since it falls back to the client's own auth token when no separate `webhookAuthToken` is configured. Because `getExpectedTwilioSignature()` sorts its parameters before signing, the key order of `body` never affects the result, so building the fixture body once and reusing it for both the signature and the request is safe.

## Asserting on TwiML responses

`TwimlInterceptor` serializes a returned TwiML builder to XML and sets `Content-Type`. Assert both from the actual HTTP response, by building the same TwiML with the SDK and comparing the serialized string:

```ts title="src/sms/reply.controller.ts"
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { TwimlInterceptor } from 'nestjs-twilio';
import twilio from 'twilio';

@Controller('sms')
export class ReplyController {
  @Post('reply')
  @UseInterceptors(TwimlInterceptor)
  reply() {
    const response = new twilio.twiml.MessagingResponse();
    response.message('Thanks, we got your message.');
    return response;
  }
}
```

```ts title="src/sms/reply.controller.spec.ts"
import { Test } from '@nestjs/testing';
import twilio from 'twilio';
import { describe, expect, it } from 'vitest';

import { ReplyController } from './reply.controller';

describe('ReplyController', () => {
  it('serializes the TwiML response and sets Content-Type', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReplyController],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    const { port } = app.getHttpServer().address();

    const response = await fetch(`http://127.0.0.1:${port}/sms/reply`, { method: 'POST' });

    const expected = new twilio.twiml.MessagingResponse();
    expected.message('Thanks, we got your message.');

    expect(response.headers.get('content-type')).toContain('text/xml');
    expect(await response.text()).toBe(expected.toString());

    await app.close();
  });
});
```

Building the expected XML with the same SDK builder, rather than hand-writing an XML string, keeps the assertion accurate even if the SDK changes attribute ordering or formatting in a future version.

## Testing error mapping

`TwilioExceptionFilter` recognizes a Twilio `RestException` structurally: an `Error` with a numeric `status` property. A stub client can throw a plain object shaped the same way, no real Twilio error required, and the filter maps it to the matching HTTP status:

```ts title="src/billing/billing.controller.spec.ts"
import { Controller, Injectable, Post, UseFilters } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  getTwilioClientToken,
  InjectTwilio,
  TwilioExceptionFilter,
  TwilioModule,
} from 'nestjs-twilio';
import { describe, expect, it, vi } from 'vitest';

import type { INestApplication } from '@nestjs/common';
import type { Twilio } from 'twilio';

class FakeRestException extends Error {
  readonly status = 429;
  readonly code = 20429;
  readonly moreInfo = 'https://www.twilio.com/docs/errors/20429';
}

@Injectable()
class BillingService {
  constructor(@InjectTwilio() private readonly client: Twilio) {}

  charge(to: string) {
    return this.client.messages.create({ to, body: 'Invoice', from: '+15557654321' });
  }
}

@Controller('billing')
@UseFilters(TwilioExceptionFilter)
class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  charge() {
    return this.billing.charge('+15551234567');
  }
}

describe('BillingController', () => {
  let app: INestApplication;

  it('maps a Twilio RestException to its original HTTP status', async () => {
    const create = vi.fn().mockRejectedValue(new FakeRestException('Too Many Requests'));
    const clientStub = { messages: { create } } as unknown as Twilio;

    const moduleRef = await Test.createTestingModule({
      imports: [
        TwilioModule.forRoot({ accountSid: `AC${'x'.repeat(32)}`, authToken: 'test_token' }),
      ],
      controllers: [BillingController],
      providers: [BillingService],
    })
      .overrideProvider(getTwilioClientToken())
      .useValue(clientStub)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    const { port } = app.getHttpServer().address();

    const response = await fetch(`http://127.0.0.1:${port}/billing`, { method: 'POST' });

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      statusCode: 429,
      message: 'Too Many Requests',
      code: '20429',
      moreInfo: 'https://www.twilio.com/docs/errors/20429',
    });

    await app.close();
  });
});
```

Combining an overridden client with a real HTTP request exercises the whole chain: the controller calls the (stubbed) client, the client rejects, and `TwilioExceptionFilter` turns that rejection into the response a real Twilio outage or rate limit would produce. See [Handle Twilio errors](/features/error-handling/) for the full response shape and status fallback rules.
