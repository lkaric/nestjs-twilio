/**
 * Shared webhook options and injection token.
 *
 * These live in their own module so `TwilioWebhookGuard` and the
 * `@TwilioWebhook()` decorator can both use them without importing each other:
 * the decorator binds the guard, and a cycle here would leave the token
 * undefined at class-definition time.
 */
/**
 * Per-route configuration accepted by {@link TwilioWebhook} and understood by
 * `TwilioWebhookGuard`.
 *
 * Every field is optional and, when omitted, falls back to whatever the
 * guard resolves from the incoming request context and, ultimately, from the
 * module-level default supplied via the {@link TWILIO_WEBHOOK_OPTIONS} DI
 * token.
 *
 * @example
 * ```ts
 * // Validate against a subaccount's token and an explicit public URL, which
 * // is what you need when the app sits behind a proxy that rewrites Host.
 * @Post('/webhooks/billing')
 * @TwilioWebhook({
 *   authToken: process.env.TWILIO_BILLING_AUTH_TOKEN,
 *   url: 'https://api.example.com/webhooks/billing',
 * })
 * handleBilling() {}
 * ```
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
export const TWILIO_WEBHOOK_OPTIONS = Symbol.for('nestjs-twilio:webhook-options');
