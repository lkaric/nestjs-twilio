import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

// Type-only: erased at compile time, so this never becomes a runtime import.
// Taken from the package root because the deep path does not resolve under
// Node's ESM loader.
import type { RestException } from 'twilio';

/**
 * JSON-serializable shape emitted by {@link TwilioExceptionFilter} whenever
 * it maps a Twilio SDK `RestException` to an HTTP response.
 *
 * @example
 * ```ts
 * const body: TwilioErrorResponse = {
 *   statusCode: 429,
 *   message: 'Too Many Requests',
 *   code: '20429',
 *   moreInfo: 'https://www.twilio.com/docs/errors/20429',
 * };
 * ```
 */
export interface TwilioErrorResponse {
  /** HTTP status code copied from the Twilio REST API response. */
  statusCode: number;
  /** Human readable error message returned by Twilio. */
  message: string;
  /** Twilio-specific error code (e.g. `"20429"`), stringified for transport. */
  code: string;
  /** Link to the Twilio error reference documentation, when provided. */
  moreInfo?: string;
  /** Additional structured error context returned by Twilio, when provided. */
  details?: unknown;
}

/**
 * Minimal, platform-agnostic subset of an HTTP response required to emit a
 * {@link TwilioErrorResponse}. Both the Express and Fastify adapters that
 * Nest ships with satisfy this shape via `res.status(...).send(...)`, so
 * this filter never needs to import platform-specific response types.
 */
interface TwilioFilterHttpResponse {
  status(statusCode: number): this;
  send(body: TwilioErrorResponse): unknown;
}

/**
 * Structural (duck-typed) check for a Twilio SDK `RestException`.
 *
 * The Twilio SDK is only imported here for its *types* (`import type`), so
 * this guard never touches the real `RestException` class at runtime. That
 * keeps {@link TwilioExceptionFilter} working even in setups where the
 * `twilio` package's runtime export shape differs (major version drift,
 * duplicated module instances across bundlers, or the class being otherwise
 * unavailable) — anything that merely *looks* like a Twilio REST error is
 * still handled correctly.
 *
 * @param exception - Value caught by the filter; may be any thrown value.
 * @returns `true` when `exception` has the shape of a Twilio `RestException`.
 *
 * @example
 * ```ts
 * try {
 *   await twilioService.client.messages.create({ ... });
 * } catch (error) {
 *   if (isTwilioRestException(error)) {
 *     console.error(error.code, error.moreInfo);
 *   }
 * }
 * ```
 */
export function isTwilioRestException(exception: unknown): exception is RestException {
  if (!(exception instanceof Error) || !('status' in exception)) {
    return false;
  }

  return typeof exception.status === 'number';
}

/**
 * Maps a Twilio `RestException` onto the {@link TwilioErrorResponse} shape,
 * preserving status, code, message, `moreInfo`, and `details`.
 */
function toTwilioErrorResponse(exception: RestException): TwilioErrorResponse {
  const response: TwilioErrorResponse = {
    statusCode:
      typeof exception.status === 'number' ? exception.status : HttpStatus.INTERNAL_SERVER_ERROR,
    message: exception.message || 'Twilio request failed',
    code:
      exception.code === undefined || exception.code === null ? 'unknown' : String(exception.code),
  };

  if (exception.moreInfo) {
    response.moreInfo = exception.moreInfo;
  }

  if (exception.details !== undefined) {
    response.details = exception.details;
  }

  return response;
}

/**
 * Maps Twilio SDK `RestException` errors to Nest HTTP responses, preserving
 * the original HTTP status, Twilio error code, message, `moreInfo` link,
 * and `details` payload as a {@link TwilioErrorResponse} JSON body.
 *
 * Uses `@Catch()` (no argument) so it can be registered globally without a
 * hard runtime dependency on the Twilio SDK's `RestException` class — it
 * recognizes Twilio errors structurally via {@link isTwilioRestException}
 * (see that function's docs for why). Any exception that isn't a Twilio
 * `RestException` is delegated to Nest's default handling via
 * `BaseExceptionFilter`, so registering this filter globally never
 * swallows unrelated errors.
 *
 * @example Per-route registration
 * ```ts
 * import { UseFilters } from '@nestjs/common';
 * import { TwilioExceptionFilter } from 'nestjs-twilio';
 *
 * @Controller('sms')
 * @UseFilters(TwilioExceptionFilter)
 * export class SmsController {
 *   constructor(@InjectTwilio() private readonly twilio: TwilioService) {}
 *
 *   @Post()
 *   send() {
 *     return this.twilio.client.messages.create({ ... });
 *   }
 * }
 * ```
 *
 * @example Global registration via useGlobalFilters
 * ```ts
 * import { HttpAdapterHost } from '@nestjs/core';
 * import { TwilioExceptionFilter } from 'nestjs-twilio';
 *
 * const app = await NestFactory.create(AppModule);
 * const { httpAdapter } = app.get(HttpAdapterHost);
 * app.useGlobalFilters(new TwilioExceptionFilter(httpAdapter));
 * await app.listen(3000);
 * ```
 *
 * @example Global registration via the APP_FILTER provider
 * ```ts
 * import { APP_FILTER } from '@nestjs/core';
 * import { TwilioExceptionFilter } from 'nestjs-twilio';
 *
 * @Module({
 *   providers: [{ provide: APP_FILTER, useClass: TwilioExceptionFilter }],
 * })
 * export class AppModule {}
 * ```
 */
@Catch()
export class TwilioExceptionFilter
  extends BaseExceptionFilter<unknown>
  implements ExceptionFilter<RestException>
{
  public override catch(exception: unknown, host: ArgumentsHost): void {
    if (!isTwilioRestException(exception)) {
      super.catch(exception, host);
      return;
    }

    const response = host.switchToHttp().getResponse<TwilioFilterHttpResponse>();

    const body = toTwilioErrorResponse(exception);

    response.status(body.statusCode).send(body);
  }
}
