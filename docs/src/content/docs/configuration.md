---
title: Register the module
description: Synchronous and asynchronous registration of TwilioModule, authenticating with an API key, and global registration.
---

`TwilioModule` is built with Nest's `ConfigurableModuleBuilder`, so it exposes
the standard `forRoot()` / `forRootAsync()` pair. Both accept the same
options shape.

:::caution[Flat options in v5]
In v4, Twilio SDK client options were nested under an `options` key. In v5,
`TwilioModuleOptions` extends the Twilio SDK's `ClientOpts` directly, so
every client option (`region`, `edge`, `logLevel`, ...) is a **top-level
key**, not nested. See the [migration guide](/migration/) if you're
upgrading.
:::

## Synchronous registration

```ts
import { Module } from '@nestjs/common';
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRoot({
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'auth_token_here',
      webhookAuthToken: 'webhook_token_override', // optional
      webhookUrl: 'https://example.com/webhooks', // optional, for proxy scenarios
      region: 'ie1', // optional, flat, not nested under `options`
      edge: 'sydney', // optional
    }),
  ],
})
export class AppModule {}
```

Credentials are validated when the module initializes. `TwilioModule` throws
a `BadRequestException` (never including the credential value itself) if:

- `accountSid` is missing or not a string
- `accountSid` doesn't start with `"AC"`
- neither `authToken`, nor `apiKey` together with `apiSecret`, is provided
- `apiKey` is given without `apiSecret`
- `apiKey` doesn't start with `"SK"`

## Authenticating with an API key

Twilio treats API keys as the preferred way to authenticate REST requests, and
they are also what [Access Tokens](https://www.twilio.com/docs/iam/access-tokens)
are signed with. Supply `apiKey` and `apiSecret` instead of `authToken`:

```ts
TwilioModule.forRoot({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  apiKey: process.env.TWILIO_API_KEY, // SK…
  apiSecret: process.env.TWILIO_API_SECRET,
});
```

`apiSecret` is mandatory whenever `apiKey` is set. The secret is what signs
the request, so a key without it cannot authenticate anything.

If both an `authToken` and an API key are supplied, the auth token wins,
matching the precedence used by the Twilio CLI and the SDK's own
environment-variable handling.

:::note[Key types]
Twilio API keys come in three types. **Main** and **Standard** keys work for
both REST requests and Access Tokens. **Restricted** keys authenticate REST
requests but [cannot mint Access Tokens](https://www.twilio.com/docs/iam/access-tokens#step-2-api-key).

All three share the `SK` prefix, so the restriction can only surface as an
error from Twilio at token-creation time.
:::

## Asynchronous registration

Use `forRootAsync()` to resolve options from another provider, such as
`ConfigService`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        accountSid: configService.get('TWILIO_ACCOUNT_SID'),
        authToken: configService.get('TWILIO_AUTH_TOKEN'),
        region: configService.get('TWILIO_REGION'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

The factory's return value is validated the same way as the synchronous
`forRoot()` options, and it is flattened the same way: no `options` key.

## Global registration

`forRoot()` always registers `TwilioModule` globally. Import it once in your
root module and `TwilioService`, the default client and every named client are
available application-wide. There is no flag to set.

This matches `TypeOrmCoreModule`, Mongoose's core module and
`BullModule.forRoot()`, all of which register globally. It is also what allows
[named clients](/features/multi-account/) to inherit the options you pass here:
a named client is registered as its own module, and a non-global root would be
invisible to it.

## Further reading

For the full list of accepted options, including every Twilio SDK client
option and every type and utility this package exports, see
[Configuration options](/reference/configuration/).
