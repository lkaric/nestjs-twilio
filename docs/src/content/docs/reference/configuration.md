---
title: Configuration options
description: Every option accepted by TwilioModule.forRoot() and forRootAsync(), and the types and utilities the package exports.
---

`TwilioModuleOptions` is the options object accepted by `TwilioModule.forRoot()`
and returned by a `forRootAsync()` factory. It extends the Twilio SDK's
`ClientOpts`, so every SDK client option is a top-level key alongside the
credential and webhook fields below. For how to use these options, see
[Register the module](/configuration/).

## Credentials

| Option       | Type     | Required                      | Description                                      |
| ------------ | -------- | ----------------------------- | ------------------------------------------------ |
| `accountSid` | `string` | Yes                           | Twilio Account SID. Must start with `AC`.        |
| `authToken`  | `string` | One of `authToken` / `apiKey` | Twilio Auth Token.                               |
| `apiKey`     | `string` | One of `authToken` / `apiKey` | Twilio API Key SID, used instead of `authToken`. |
| `apiSecret`  | `string` | Required if `apiKey` is set   | Twilio API Key Secret.                           |

## Webhook defaults

| Option             | Type     | Description                                                                                                                             |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `webhookAuthToken` | `string` | Default auth token used by [`TwilioWebhookGuard`](/features/webhook-validation/) for signature validation. Can be overridden per route. |
| `webhookUrl`       | `string` | Default public URL used to reconstruct the signed webhook URL, for deployments behind a proxy.                                          |

## Module-level extras

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |

## Twilio SDK client options (flat, from `ClientOpts`)

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

These come directly from the `twilio` package's `ClientOpts` type. Consult
the [Twilio Node.js SDK documentation](https://www.twilio.com/docs/libraries/node) for
behavior details.

## Exported types and utilities

Everything below is part of the public API and therefore covered by semver.

| Export                       | Kind      | Purpose                                                                                                                                                          |
| ---------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TwilioClientOpts`           | interface | The credential fields plus every Twilio SDK `ClientOpts` key, flattened. `TwilioModuleOptions` extends it.                                                       |
| `TwilioClientRegistration`   | interface | A named client passed to `registerClient()`. Every field except `name` is optional and inherited from `forRoot()`.                                               |
| `TwilioClientOptionsFactory` | interface | Implemented by a class supplying a named client's options via `registerClientAsync({ useClass })`.                                                               |
| `validateTwilioOptions`      | function  | The bootstrap validation the module runs for you. Exported so you can validate configuration yourself before constructing a module (useful in a config factory). |
| `createTwilioClient`         | function  | The factory the module uses to build a client. Exported for tests and for advanced cases where you need a client outside Nest's DI container.                    |

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
