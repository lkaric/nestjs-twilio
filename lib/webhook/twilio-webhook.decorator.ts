import { SetMetadata } from '@nestjs/common';

import type { CustomDecorator } from '@nestjs/common';

/**
 * Per-route configuration accepted by {@link TwilioWebhook} and understood by
 * `TwilioWebhookGuard`.
 *
 * Every field is optional and, when omitted, falls back to whatever the
 * guard resolves from the incoming request context and, ultimately, from the
 * module-level default supplied via the {@link TWILIO_WEBHOOK_OPTIONS} DI
 * token.
 */
export interface TwilioWebhookOptions {
  /**
   * The Twilio auth token used to compute the expected signature. Overrides
   * any request-context or module-level default for the decorated route.
   */
  authToken?: string;

  /**
   * The full public URL (including query string) Twilio was configured to
   * call for this webhook. Required whenever the request reaches your
   * application through a rewrite that the `protocol`/`host` overrides
   * cannot describe (e.g. a path rewrite done by a reverse proxy).
   */
  url?: string;

  /**
   * Overrides the protocol used to reconstruct the webhook URL when `url`
   * is not supplied. Useful behind proxies/load balancers that terminate
   * TLS before the request reaches Nest.
   */
  protocol?: 'http' | 'https';

  /**
   * Overrides the host used to reconstruct the webhook URL when `url` is
   * not supplied. Useful behind proxies that rewrite the `Host` header.
   */
  host?: string;

  /**
   * Skips signature validation entirely for the decorated route/class when
   * `true`. Intended for local development or endpoints that are
   * intentionally public.
   */
  disableValidation?: boolean;
}

/**
 * Metadata key `TwilioWebhookGuard` reads via `Reflector` to obtain the
 * options a route was decorated with, and the DI token an application (or
 * the Twilio module) can optionally use to provide the guard's module-level
 * default {@link TwilioWebhookOptions}.
 *
 * Reusing the same symbol for both purposes is intentional: Nest's
 * `Reflector` reads it from handler/class metadata, while Nest's DI
 * container reads it from the provider registry - the two lookups never
 * collide.
 *
 * @example
 * ```ts
 * // Supplying a module-level default auth token for TwilioWebhookGuard:
 * providers: [
 *   { provide: TWILIO_WEBHOOK_OPTIONS, useValue: { authToken: process.env.TWILIO_AUTH_TOKEN } },
 * ],
 * ```
 */
export const TWILIO_WEBHOOK_OPTIONS = Symbol('TWILIO_WEBHOOK_OPTIONS');

/**
 * Configures `TwilioWebhookGuard` for a controller class or a single
 * handler method. Options declared here take priority over any per-request
 * context and the module-level default (see {@link TWILIO_WEBHOOK_OPTIONS}).
 *
 * Applying it on a controller class sets the default for every handler in
 * that controller; applying it again on a method overrides the class-level
 * options for that handler only.
 *
 * @param options - Per-route webhook validation overrides.
 * @example
 * ```ts
 * ⠀@Controller('webhooks/twilio')
 * ⠀@UseGuards(TwilioWebhookGuard)
 * export class TwilioWebhookController {
 * ⠀ @Post('sms')
 * ⠀ @TwilioWebhook({ url: 'https://example.com/webhooks/twilio/sms' })
 * ⠀ handleIncomingSms(@Body() body: Record<string, string>) {
 * ⠀   // body has already been signature-validated by TwilioWebhookGuard.
 * ⠀ }
 * }
 * ```
 */
export function TwilioWebhook(
  options: TwilioWebhookOptions = {}
): CustomDecorator<typeof TWILIO_WEBHOOK_OPTIONS> {
  return SetMetadata(TWILIO_WEBHOOK_OPTIONS, options);
}
