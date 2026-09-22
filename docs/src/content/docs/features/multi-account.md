---
title: Multi-Account Clients
description: Register additional named Twilio clients for subaccounts with registerClient and registerClientAsync.
---

`TwilioModule.forRoot()` configures the default client **and** the options every
named client inherits. `TwilioModule.registerClient()` adds further clients —
typically Twilio subaccounts — which inherit those options and override only
what differs.

This mirrors `BullModule.forRoot()` / `BullModule.registerQueue()` in
`@nestjs/bullmq`, where the root registration holds shared configuration and
each named registration inherits it.

## Basic usage

```ts
import { Module } from '@nestjs/common';
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRoot({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      region: 'ie1',
      edge: 'dublin',
    }),
    TwilioModule.registerClient({
      name: 'billing',
      accountSid: process.env.TWILIO_BILLING_ACCOUNT_SID,
      authToken: process.env.TWILIO_BILLING_AUTH_TOKEN,
    }),
  ],
})
export class AppModule {}
```

The `billing` client uses its own credentials but inherits `region: 'ie1'` and
`edge: 'dublin'` from the root registration.

## Injecting a named client

```ts
import { Injectable } from '@nestjs/common';
import { InjectTwilio, type TwilioClient } from 'nestjs-twilio';

@Injectable()
export class BillingService {
  constructor(@InjectTwilio('billing') private readonly twilio: TwilioClient) {}
}
```

Names are matched case-insensitively, so `'Billing'` and `'billing'` resolve to
the same client. `@InjectTwilio()` with no argument resolves the default client
from `forRoot()`.

To resolve the token directly — when wiring a provider by hand, for example —
use `getTwilioClientToken('billing')`.

## What is inherited

Every option from `forRoot()` is inherited unless the named client overrides it
with a **defined** value.

| Registration           | Result                        |
| ---------------------- | ----------------------------- |
| Key omitted            | Inherited from `forRoot()`    |
| Key set to `undefined` | Inherited from `forRoot()`    |
| Key set to a value     | Overrides the inherited value |

:::caution[`undefined` inherits, it does not clear]
This differs deliberately from `@nestjs/bullmq`, which merges with a plain
object spread where a present-but-`undefined` key clears the inherited value.

Configuration is usually read from the environment, and
`region: process.env.TWILIO_REGION` is `undefined` whenever that variable is
unset. Under a plain spread that would silently discard an inherited region and
send traffic to Twilio's default edge.

Nothing is lost: `region` and `edge` are named values, so returning one client
to the default is expressed by naming it.
:::

```ts
// Inherits region 'ie1' even though the key is present.
TwilioModule.registerClient({
  name: 'billing',
  accountSid,
  authToken,
  region: process.env.BILLING_REGION, // undefined when unset
});

// Deliberately overrides, routing this client through Australia.
TwilioModule.registerClient({ name: 'au', accountSid, authToken, region: 'au1' });
```

## Asynchronous registration

`registerClientAsync()` accepts the same shape as Nest's own generated `*Async`
methods. Use exactly one of `useFactory`, `useClass` or `useExisting`.

```ts
TwilioModule.registerClientAsync({
  name: 'billing',
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    accountSid: config.getOrThrow('TWILIO_BILLING_ACCOUNT_SID'),
    authToken: config.getOrThrow('TWILIO_BILLING_AUTH_TOKEN'),
  }),
  inject: [ConfigService],
});
```

With a factory class, implement `TwilioClientOptionsFactory`:

```ts
import { Injectable } from '@nestjs/common';
import type { TwilioClientOptionsFactory, TwilioModuleOptions } from 'nestjs-twilio';

@Injectable()
export class BillingTwilioConfig implements TwilioClientOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTwilioClientOptions(): Partial<TwilioModuleOptions> {
    return {
      accountSid: this.config.getOrThrow('TWILIO_BILLING_ACCOUNT_SID'),
      authToken: this.config.getOrThrow('TWILIO_BILLING_AUTH_TOKEN'),
    };
  }
}
```

```ts
TwilioModule.registerClientAsync({ name: 'billing', useClass: BillingTwilioConfig });
```

Options resolved asynchronously inherit from `forRoot()` exactly as synchronous
ones do.

## Without a root registration

`registerClient()` works on its own, which suits a platform where every tenant
is a subaccount and there is no meaningful primary account. Each registration
must then carry full credentials, since there is nothing to inherit.

```ts
@Module({
  imports: [
    TwilioModule.registerClient({ name: 'tenant-a', accountSid: '…', authToken: '…' }),
    TwilioModule.registerClient({ name: 'tenant-b', accountSid: '…', authToken: '…' }),
  ],
})
export class AppModule {}
```

:::note
Without `forRoot()` there is no default client, so `TwilioService` and
`@InjectTwilio()` with no name are not provided. Injecting either fails at
bootstrap rather than resolving to something half-configured.
:::

## Global registration

`forRoot()` always registers globally, as `TypeOrmCoreModule`, Mongoose's core
module and `BullModule.forRoot()` all do. Import it once in your root module
and every client is available application-wide.

This is also what makes inheritance work: a named client is registered as its
own module, and a non-global root would be invisible to it.

## API

- `TwilioModule.forRoot(options)` — the default client, and the options named
  clients inherit
- `TwilioModule.forRootAsync({ useFactory | useClass | useExisting, inject?, imports? })`
- `TwilioModule.registerClient({ name, ...overrides })` — an additional named client
- `TwilioModule.registerClientAsync({ name, useFactory | useClass | useExisting, inject?, imports? })`
- `getTwilioClientToken(name?)` — the DI token for a client
- `@InjectTwilio(name?)` — inject a client
