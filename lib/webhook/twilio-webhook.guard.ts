import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// `twilio` is CommonJS; named value imports throw under Node's ESM loader.
// A default import always yields `module.exports`, so it works in both builds.
import twilio from 'twilio';

import { TWILIO_WEBHOOK_OPTIONS } from './twilio-webhook.decorator.js';

import type { TwilioWebhookOptions } from './twilio-webhook.decorator.js';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

/** Header Twilio signs every webhook request with. */
const TWILIO_SIGNATURE_HEADER = 'x-twilio-signature';

/**
 * Minimal, platform-agnostic shape of the properties `TwilioWebhookGuard`
 * reads off the incoming request. Both the Express and the Fastify Nest
 * HTTP adapters satisfy it.
 *
 * `rawBody` is only required for JSON webhooks (those Twilio signs with a
 * `bodySHA256` query parameter): enable it via
 * `NestFactory.create(AppModule, { rawBody: true })`, which makes Nest
 * populate it with the exact bytes received.
 */
export interface TwilioWebhookRequest {
  protocol?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  rawBody?: string | Buffer;
}

/**
 * Nest guard that validates the `X-Twilio-Signature` header on inbound
 * Twilio webhook requests, rejecting anything that was not sent - byte for
 * byte - by Twilio for the exact URL and body the guard reconstructs.
 *
 * It supports both classic form-encoded webhooks (validated with
 * `validateRequest`) and JSON webhooks signed with a `bodySHA256` query
 * parameter (validated with `validateRequestWithBody`), automatically
 * selecting between them based on the resolved webhook URL. Signature
 * comparison is delegated to the `twilio` SDK, which compares digests with
 * `scmp` (constant-time) rather than `===`.
 *
 * The auth token and URL used for validation are resolved, per option,
 * with the following priority:
 * 1. `@TwilioWebhook()` decorator options on the matched handler/class.
 * 2. A per-request override attached by earlier middleware/guards at
 *    `request[TWILIO_WEBHOOK_OPTIONS]`.
 * 3. The module-level default, optionally injected via the
 *    `TWILIO_WEBHOOK_OPTIONS` DI token.
 *
 * @example
 * ```ts
 * ⠀@Controller('webhooks/twilio')
 * ⠀@UseGuards(TwilioWebhookGuard)
 * export class TwilioWebhookController {
 * ⠀ @Post('sms')
 * ⠀ handleIncomingSms(@Body() body: Record<string, string>) {
 * ⠀   // Only reached once the signature has been validated.
 * ⠀ }
 * }
 *
 * // app.module.ts
 * providers: [
 * ⠀ TwilioWebhookGuard,
 * ⠀ { provide: TWILIO_WEBHOOK_OPTIONS, useValue: { authToken: process.env.TWILIO_AUTH_TOKEN } },
 * ],
 * ```
 */
@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(TWILIO_WEBHOOK_OPTIONS)
    private readonly defaultOptions?: TwilioWebhookOptions
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const decoratorOptions = this.reflector.getAllAndOverride<TwilioWebhookOptions | undefined>(
      TWILIO_WEBHOOK_OPTIONS,
      [context.getHandler(), context.getClass()]
    );

    if (decoratorOptions?.disableValidation) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TwilioWebhookRequest>();
    const requestOptions = (
      request as unknown as Partial<Record<typeof TWILIO_WEBHOOK_OPTIONS, TwilioWebhookOptions>>
    )[TWILIO_WEBHOOK_OPTIONS];

    const options: TwilioWebhookOptions = {
      ...this.defaultOptions,
      ...requestOptions,
      ...decoratorOptions,
    };

    if (!options.authToken) {
      throw new ForbiddenException(
        'Twilio webhook signature could not be validated: no auth token is configured.'
      );
    }

    const headerValue = request.headers[TWILIO_SIGNATURE_HEADER];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!signature) {
      throw new ForbiddenException(
        `Twilio webhook signature could not be validated: missing "${TWILIO_SIGNATURE_HEADER}" header.`
      );
    }

    const url = this.resolveWebhookUrl(request, options);

    const isValid = url.includes('bodySHA256')
      ? twilio.validateRequestWithBody(
          options.authToken,
          signature,
          url,
          this.resolveRawBody(request)
        )
      : twilio.validateRequest(
          options.authToken,
          signature,
          url,
          this.isPlainObject(request.body) ? request.body : {}
        );

    if (!isValid) {
      throw new ForbiddenException('Twilio webhook signature validation failed.');
    }

    return true;
  }

  /**
   * Reconstructs the full public URL Twilio would have signed, honoring
   * `options.url` first, then `options.protocol`/`options.host`, then
   * `X-Forwarded-Proto`/`X-Forwarded-Host` (for proxied deployments), and
   * finally the values Nest's HTTP adapter observed directly.
   */
  private resolveWebhookUrl(request: TwilioWebhookRequest, options: TwilioWebhookOptions): string {
    if (options.url) {
      return options.url;
    }

    const forwardedProto = this.firstHeaderValue(request.headers['x-forwarded-proto']);
    const forwardedHost = this.firstHeaderValue(request.headers['x-forwarded-host']);
    const hostHeader = this.firstHeaderValue(request.headers.host);

    const protocol = options.protocol ?? forwardedProto ?? request.protocol ?? 'https';
    const host = options.host ?? forwardedHost ?? hostHeader ?? '';
    const path = request.originalUrl ?? request.url ?? '';

    return `${protocol}://${host}${path}`;
  }

  /** Takes the first value out of a raw or comma-joined forwarding header. */
  private firstHeaderValue(value: string | string[] | undefined): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;

    return raw?.split(',')[0]?.trim();
  }

  /**
   * The exact bytes Twilio sent, required to validate a JSON webhook's
   * `bodySHA256` parameter. Falls back to re-serializing the parsed body
   * when `rawBody` was not captured, which only produces a matching hash if
   * the serialized form happens to be byte-identical to what Twilio sent.
   */
  private resolveRawBody(request: TwilioWebhookRequest): string {
    if (typeof request.rawBody === 'string') {
      return request.rawBody;
    }

    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody.toString('utf-8');
    }

    return JSON.stringify(request.body ?? {});
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
