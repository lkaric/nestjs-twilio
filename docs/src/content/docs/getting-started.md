---
title: Getting Started
description: Install nestjs-twilio and register the Twilio client in your NestJS application.
---

`nestjs-twilio` provides an injectable Twilio SDK client for NestJS
applications, along with webhook signature validation, TwiML response
serialization, automatic error mapping, and multi-account support.

## Requirements

- Node.js `>=20.19.0`
- `@nestjs/common` and `@nestjs/core` `^11.0.0 || ^12.0.0`
- `twilio` `^5.0.0 || ^6.0.0`
- `reflect-metadata` `^0.1.12 || ^0.2.0`
- `rxjs` `^7.8.0`

## Installation

As of v5, `twilio` is a **peer dependency**. It is no longer installed
transitively, so you must install it alongside this package:

```bash
npm install nestjs-twilio twilio
```

## 1. Register the module

Import `TwilioModule` and call `forRoot()` with your account credentials:

```ts
import { Module } from '@nestjs/common';
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRoot({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    }),
  ],
})
export class AppModule {}
```

Credentials are validated when the module initializes: if `accountSid` is
missing, doesn't start with `AC`, or neither `authToken` nor `apiKey` is
supplied, `TwilioModule` throws a `BadRequestException` naming the offending
field before your application finishes bootstrapping.

## 2. Inject the client

Use the `@InjectTwilio()` parameter decorator to inject the raw Twilio SDK
client anywhere in your application:

```ts
import { Injectable } from '@nestjs/common';
import { InjectTwilio } from 'nestjs-twilio';
import type { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  constructor(@InjectTwilio() private readonly twilioClient: Twilio) {}

  async sendSms(to: string, body: string) {
    return this.twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });
  }
}
```

Alternatively, inject the `TwilioService` wrapper and access the client
through its `.client` getter:

```ts
import { Injectable } from '@nestjs/common';
import { TwilioService } from 'nestjs-twilio';

@Injectable()
export class SmsService {
  constructor(private readonly twilioService: TwilioService) {}

  async sendSms(to: string, body: string) {
    return this.twilioService.client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });
  }
}
```

## Next steps

- [Configuration](/configuration/): synchronous and asynchronous
  registration, and the full client options table.
- [Webhook validation](/features/webhook-validation/): verify inbound
  Twilio requests.
- [TwiML responses](/features/twiml-responses/): return TwiML XML from
  controllers.
- [Error handling](/features/error-handling/): map Twilio SDK errors to
  HTTP responses.
- [Multi-account clients](/features/multi-account/): register additional
  named clients for subaccounts.

Upgrading from v4? See the [migration guide](/migration/).
