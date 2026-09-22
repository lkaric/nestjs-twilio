---
title: Error Handling
description: Map the Twilio SDK's RestException to Nest HTTP responses with TwilioExceptionFilter.
---

Calls made through the injected Twilio client throw the SDK's
`RestException` when the Twilio REST API returns an error. `TwilioExceptionFilter`
catches those and turns them into a structured HTTP response, preserving the
original status code, Twilio error code, message, and `more_info` link.

## Usage

### Per-controller

```ts
import { Controller, UseFilters } from '@nestjs/common';
import { TwilioExceptionFilter, InjectTwilio } from 'nestjs-twilio';
import type { Twilio } from 'twilio';

@Controller('sms')
@UseFilters(TwilioExceptionFilter)
export class SmsController {
  constructor(@InjectTwilio() private readonly twilio: Twilio) {}

  @Post()
  send() {
    return this.twilio.messages.create({/* ... */});
  }
}
```

### Global, via `useGlobalFilters`

```ts
import { NestFactory } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';
import { TwilioExceptionFilter } from 'nestjs-twilio';

const app = await NestFactory.create(AppModule);
const { httpAdapter } = app.get(HttpAdapterHost);
app.useGlobalFilters(new TwilioExceptionFilter(httpAdapter));
await app.listen(3000);
```

### Global, via `APP_FILTER` provider

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TwilioExceptionFilter } from 'nestjs-twilio';

@Module({
  providers: [{ provide: APP_FILTER, useClass: TwilioExceptionFilter }],
})
export class AppModule {}
```

## How matching works

`TwilioExceptionFilter` is declared with `@Catch()` (no argument), so it can
be registered globally without a hard runtime dependency on the Twilio SDK's
`RestException` class. It recognizes Twilio errors **structurally** via
`isTwilioRestException()`, checking that the thrown value is an `Error`
with a numeric `status` property, rather than an `instanceof` check.

Any exception that is not a Twilio `RestException` is delegated to Nest's
default handling via `BaseExceptionFilter`, so registering this filter
globally never swallows unrelated application errors.

## Response shape

When a `RestException` is caught, the filter writes a JSON body shaped as
`TwilioErrorResponse`:

```ts
interface TwilioErrorResponse {
  statusCode: number; // copied from the Twilio REST API response
  message: string; // human-readable message from Twilio
  code: string; // Twilio-specific error code, e.g. "20429"
  moreInfo?: string; // link to the Twilio error reference, when provided
  details?: unknown; // additional structured error context, when provided
}
```

Example response body for a rate-limited request:

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "code": "20429",
  "moreInfo": "https://www.twilio.com/docs/errors/20429"
}
```

If `exception.status` isn't a number, `statusCode` falls back to `500`
(`HttpStatus.INTERNAL_SERVER_ERROR`). If `exception.code` is missing,
`code` falls back to the string `"unknown"`.

## Reference

### Exports

- `TwilioExceptionFilter`: the `ExceptionFilter`, extending Nest's
  `BaseExceptionFilter`.
- `isTwilioRestException(exception)`: structural type guard for a Twilio
  `RestException`.
- `TwilioErrorResponse`: the response body type described above.
