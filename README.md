<p align="center">
  <h3 align="center">nestjs-twilio</h3>
  <p align="center">
    <img src="https://www.twilio.com/content/dam/twilio-com/global/en/brand/mark.png" width="80"/>
  </p>
  <p align="center">
    Injectable Twilio client for NestJS
  </p>
</p>

[![npm version](https://img.shields.io/npm/v/nestjs-twilio)](https://www.npmjs.com/package/nestjs-twilio)
[![Build Status](https://github.com/lkaric/nestjs-twilio/actions/workflows/build.yml/badge.svg)](https://github.com/lkaric/nestjs-twilio/actions)
[![MIT License](https://img.shields.io/github/license/lkaric/nestjs-twilio)](LICENSE)

Full-featured NestJS integration for Twilio with:

- ✅ Dependency injection of Twilio SDK
- ✅ Webhook signature validation
- ✅ TwiML response serialization
- ✅ Automatic error mapping
- ✅ Multi-account / subaccount clients
- ✅ TypeScript-first with full type support

## Installation

```bash
npm install nestjs-twilio twilio
```

### Requirements

|                                  | Version        |
| -------------------------------- | -------------- |
| Node.js                          | `>=20.19`      |
| `@nestjs/common`, `@nestjs/core` | `^11 \|\| ^12` |
| `twilio`                         | `^5 \|\| ^6`   |

`reflect-metadata` and `rxjs` are peer dependencies too, and are already
present in any Nest application. `@nestjs/terminus` is an optional peer.

> **On the Node floor.** The test suite runs on Node 22 and 24. Node 20.19 is
> supported and CI verifies on every run that both the CommonJS and ES module
> builds load there with identical export surfaces, but the unit suite itself
> cannot execute on 20.x — Vitest 5 requires `^22.12 || ^24 || >=26`. If you
> run Node 20, prefer pinning a patch release you have exercised yourself.

## Quick Start

### 1. Register the module

```typescript
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

### 2. Inject the client

```typescript
import { Injectable } from '@nestjs/common';
import { InjectTwilio } from 'nestjs-twilio';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  constructor(@InjectTwilio() private twilioClient: Twilio) {}

  async sendSms(to: string, body: string) {
    return this.twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });
  }
}
```

## Key Features

### Webhook Signature Validation

Automatically validate incoming Twilio webhooks:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { TwilioWebhook, TwilioWebhookRequest } from 'nestjs-twilio';

@Controller('webhooks/sms')
export class WebhookController {
  @Post()
  @TwilioWebhook()
  handleIncomingSms(@Body() body: TwilioWebhookRequest) {
    console.log('From:', body.From);
    console.log('Body:', body.Body);
  }
}
```

### TwiML Responses

Return TwiML directly from controllers:

```typescript
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
    return response;
  }
}
```

### Error Handling

Twilio errors are automatically mapped to HTTP exceptions:

```typescript
import { Controller, UseFilters } from '@nestjs/common';
import { TwilioExceptionFilter } from 'nestjs-twilio';

@Controller('api')
@UseFilters(TwilioExceptionFilter)
export class ApiController {
  // Twilio SDK errors → HTTP 4xx/5xx responses
}
```

### Multiple Accounts

Register additional named clients for subaccounts, then inject them by name:

```typescript
@Module({
  imports: [
    TwilioModule.forRoot({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    }),
    TwilioModule.forFeature('billing', {
      accountSid: process.env.TWILIO_BILLING_ACCOUNT_SID,
      authToken: process.env.TWILIO_BILLING_AUTH_TOKEN,
    }),
  ],
})
export class AppModule {}
```

```typescript
@Injectable()
export class BillingService {
  constructor(@InjectTwilio('billing') private readonly twilio: Twilio) {}
}
```

`forFeatureAsync(name, options)` is available for factory-based configuration.

## Configuration

### Synchronous Registration

```typescript
TwilioModule.forRoot({
  accountSid: 'ACxxxxxxx',
  authToken: 'auth_token_here',
  webhookAuthToken: 'webhook_token_override', // optional
  webhookUrl: 'https://example.com/webhooks', // optional for proxy scenarios
  region: 'ie1', // optional
  edge: 'sydney', // optional
  isGlobal: true, // optional - make module globally available
});
```

### Asynchronous Registration

```typescript
TwilioModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    accountSid: configService.get('TWILIO_ACCOUNT_SID'),
    authToken: configService.get('TWILIO_AUTH_TOKEN'),
  }),
  inject: [ConfigService],
});
```

## Migration from v4

v5.0.0 introduces breaking changes. See [MIGRATION.md](./MIGRATION.md) for a complete upgrade guide.

**Key changes:**

- `twilio` moved to `peerDependencies` — install it alongside this package
- Nest peer range is now `^11 || ^12`
- Minimum Node.js is 20.19
- Client options are flat: `options: { region }` is now `region`
- Credentials are validated at bootstrap instead of failing later inside the SDK

## Contributing

Setup, conventions, commit format and the checks CI runs are documented in
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Support

- 📖 [Documentation](https://nestjs-twilio.lazar.sh)
- 🐛 [Report an issue](https://github.com/lkaric/nestjs-twilio/issues)
- 🔒 [Report a vulnerability](./SECURITY.md)
- 💬 [Discussions](https://github.com/lkaric/nestjs-twilio/discussions)

## License

MIT © [Lazar Karic](https://lazar.sh)
