---
title: Configuration
description: Synchronous and asynchronous registration of TwilioModule, and the full client options reference.
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
      region: 'ie1', // optional — flat, not nested under `options`
      edge: 'sydney', // optional
      isGlobal: true, // optional — makes the module globally available
    }),
  ],
})
export class AppModule {}
```

Credentials are validated when the module initializes. `TwilioModule` throws
a `BadRequestException` — never including the credential value itself — if:

- `accountSid` is missing or not a string
- `accountSid` doesn't start with `"AC"`
- neither `authToken` nor `apiKey` is provided

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
`forRoot()` options, and it is flattened the same way — no `options` key.

## `isGlobal`

`isGlobal` is a top-level key handled separately from the client options: it
controls whether `TwilioModule` is registered as a Nest global module, and is
never passed to the underlying Twilio SDK client.

```ts
TwilioModule.forRoot({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  isGlobal: true,
});
```

Default: `false`.

## Full options reference

### Credentials

| Option       | Type     | Required                      | Description                                      |
| ------------ | -------- | ----------------------------- | ------------------------------------------------ |
| `accountSid` | `string` | Yes                           | Twilio Account SID. Must start with `AC`.        |
| `authToken`  | `string` | One of `authToken` / `apiKey` | Twilio Auth Token.                               |
| `apiKey`     | `string` | One of `authToken` / `apiKey` | Twilio API Key SID, used instead of `authToken`. |
| `apiSecret`  | `string` | Required if `apiKey` is set   | Twilio API Key Secret.                           |

### Webhook defaults

| Option             | Type     | Description                                                                                                                             |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `webhookAuthToken` | `string` | Default auth token used by [`TwilioWebhookGuard`](/features/webhook-validation/) for signature validation. Can be overridden per route. |
| `webhookUrl`       | `string` | Default public URL used to reconstruct the signed webhook URL, for deployments behind a proxy.                                          |

### Module-level extras

| Option     | Type      | Default | Description                                                                        |
| ---------- | --------- | ------- | ---------------------------------------------------------------------------------- |
| `isGlobal` | `boolean` | `false` | Registers `TwilioModule` as a global Nest module. Not forwarded to the SDK client. |

### Twilio SDK client options (flat, from `ClientOpts`)

Every option below is a passthrough to the underlying `twilio` SDK
constructor and is optional.

| Option                | Type                      | Description                                                        |
| --------------------- | ------------------------- | ------------------------------------------------------------------ |
| `region`              | `string`                  | Twilio Region to route requests through.                           |
| `edge`                | `string`                  | Twilio Edge to route requests through.                             |
| `env`                 | `NodeJS.ProcessEnv`       | Environment variables object used to resolve region/edge defaults. |
| `httpClient`          | `RequestClient`           | Custom HTTP client implementation.                                 |
| `lazyLoading`         | `boolean`                 | Lazily loads domain objects on first access.                       |
| `logLevel`            | `string`                  | SDK log verbosity.                                                 |
| `userAgentExtensions` | `string[]`                | Extra strings appended to the SDK's `User-Agent` header.           |
| `autoRetry`           | `boolean`                 | Automatically retries idempotent requests on transient failure.    |
| `maxRetryDelay`       | `number`                  | Maximum delay (ms) between automatic retries.                      |
| `maxRetries`          | `number`                  | Maximum number of automatic retries.                               |
| `validationClient`    | `ValidationClientOptions` | Options for the SDK's request-validation client.                   |
| `timeout`             | `number`                  | Socket timeout (ms) for the underlying HTTPS agent.                |
| `keepAlive`           | `boolean`                 | Enables HTTP keep-alive.                                           |
| `keepAliveMsecs`      | `number`                  | Keep-alive probe interval (ms).                                    |
| `maxSockets`          | `number`                  | Maximum sockets per host.                                          |
| `maxTotalSockets`     | `number`                  | Maximum sockets across all hosts.                                  |
| `maxFreeSockets`      | `number`                  | Maximum idle sockets to keep open.                                 |
| `scheduling`          | `'fifo' \| 'lifo'`        | Socket reuse scheduling strategy.                                  |
| `ca`                  | `string \| Buffer`        | Custom CA certificate for TLS requests.                            |

These come directly from the `twilio` package's `ClientOpts` type — consult
the [Twilio Node.js SDK documentation](https://www.twilio.com/docs/libraries/node) for
behavior details.

## Exported types and utilities

Everything below is part of the public API and therefore covered by semver.

| Export                         | Kind      | Purpose                                                                                                                                                                                  |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TwilioClientOpts`             | interface | The credential fields plus every Twilio SDK `ClientOpts` key, flattened. `TwilioModuleOptions` extends it.                                                                               |
| `TwilioModuleDefinitionExtras` | interface | Module-level configuration that is _not_ injected into providers — currently just `isGlobal`. Kept separate so module wiring never leaks into the options object your providers receive. |
| `validateTwilioOptions`        | function  | The bootstrap validation the module runs for you. Exported so you can validate configuration yourself before constructing a module — useful in a config factory.                         |
| `createTwilioClient`           | function  | The factory the module uses to build a client. Exported for tests and for advanced cases where you need a client outside Nest's DI container.                                            |

```ts
import { createTwilioClient, validateTwilioOptions } from 'nestjs-twilio';

const options = {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
};

// Throws BadRequestException naming the offending field; never echoes secrets.
validateTwilioOptions(options);

const client = createTwilioClient(options);
```

:::note
`validateTwilioOptions` runs automatically inside `createTwilioClient` and
during module initialisation. Calling it yourself is only useful when you want
to fail earlier, for example while loading configuration.
:::
