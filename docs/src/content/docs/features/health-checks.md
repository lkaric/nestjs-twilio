---
title: Add health checks
description: Report Twilio API reachability and credential validity through a Terminus health indicator.
---

`TwilioHealthIndicator` reports whether the Twilio API is reachable and your
credentials are still accepted, as a [Terminus](https://docs.nestjs.com/recipes/terminus)
health indicator.

## Installation

`@nestjs/terminus` is an **optional** peer dependency. Install it only if you
want health checks:

```bash
npm install @nestjs/terminus
```

## Importing

The indicator is exported from the `nestjs-twilio/terminus` subpath, **not**
from the package root:

```ts
import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';
```

:::note[Not in the generated API reference]
The [API reference](/api/readme/) is generated from the package root, so
`TwilioHealthIndicator` does not appear there. This page is its documentation;
its JSDoc still shows on hover in your editor.
:::

:::note[Why a subpath]
If the indicator were exported from the package root, importing anything from
`nestjs-twilio` would eagerly resolve `@nestjs/terminus` and throw
`ERR_MODULE_NOT_FOUND` for every consumer who hasn't installed it. The subpath
keeps the root entry free of the optional peer, and CI asserts that on every
build.
:::

## Usage

```ts title="src/health/health.module.ts"
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';

import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [TwilioHealthIndicator],
})
export class HealthModule {}
```

```ts title="src/health/health.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly twilio: TwilioHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.twilio.isHealthy('twilio').withTimeout(5000)]);
  }
}
```

A healthy response:

```json
{
  "status": "ok",
  "info": {
    "twilio": {
      "status": "up",
      "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "friendlyName": "My Twilio Account",
      "responseTime": 143
    }
  },
  "error": {},
  "details": { "twilio": { "status": "up", "responseTime": 143 } }
}
```

## What the check does

It fetches the client's own Account resource, which exercises both network
reachability and credential validity in a single call.

The indicator reports **down** when:

- the request fails: network error, invalid credentials, Twilio outage
- the account status is not `active`, i.e. `suspended` or `closed`

A suspended account still authenticates but cannot send anything, so treating
it as healthy would be misleading.

## Checking named clients

Pass a client as the second argument to probe a client registered with
[`registerClient()`](/features/multi-account/):

```ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly twilio: TwilioHealthIndicator,
    @InjectTwilio('billing') private readonly billing: TwilioClient
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.twilio.isHealthy('twilio').withTimeout(5000),
      () => this.twilio.isHealthy('twilio-billing', this.billing).withTimeout(5000),
    ]);
  }
}
```

With no argument the default client from `forRoot()` is used. If no client is
registered at all, the indicator reports **down** with guidance rather than
throwing.

## Timeouts

`isHealthy()` returns Terminus' attempt builder, so `withTimeout()` and
`cacheFor()` chain as they do for any indicator.

:::caution[The SDK ignores the abort signal]
Terminus passes an `AbortSignal` to the attempt so a timed-out check can cancel
its underlying request. The Twilio SDK's request client **does not accept one**,
so `withTimeout()` marks the indicator down while the HTTP request keeps
running in the background.

Bound the request at the SDK instead, with its own `timeout` option:

```ts
TwilioModule.forRoot({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  timeout: 5000, // milliseconds, enforced by the Twilio SDK
});
```

:::

Every Twilio health check is a real API request. Use `cacheFor()` if your
orchestrator probes frequently:

```ts
() => this.twilio.isHealthy('twilio').withTimeout(5000).cacheFor(30_000);
```

## Failure reporting

The indicator is built on Terminus' `attempt()`, not `up()`/`down()`. That
distinction matters: an indicator written with `up()`/`down()` that _throws_
aborts the entire health check and returns **500**, whereas `attempt()`
translates a thrown error into a `down` result and the expected **503**.

With invalid credentials you get:

```json
{
  "status": "error",
  "error": {
    "twilio": {
      "status": "down",
      "message": "Authentication Error - invalid username",
      "responseTime": 412
    }
  }
}
```
