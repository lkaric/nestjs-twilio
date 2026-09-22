import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { TWILIO_WEBHOOK_OPTIONS } from './twilio-webhook.options.js';
import { TwilioWebhookGuard } from './twilio-webhook.guard.js';

import type { TwilioWebhookOptions } from './twilio-webhook.options.js';

/**
 * Validates that a request was signed by Twilio, and configures how.
 *
 * Binds {@link TwilioWebhookGuard} to the decorated route or controller and
 * records the supplied options for it to read — so the decorator alone is
 * sufficient. There is no separate `@UseGuards()` to remember, and therefore
 * no way to record webhook options while leaving the route unprotected.
 *
 * Applying it to a controller class protects every handler in that controller.
 * Applying it again on a method overrides the class-level options for that
 * handler only.
 *
 * Options precedence, highest first: this decorator, then any per-request
 * context, then the module-level default provided under
 * {@link TWILIO_WEBHOOK_OPTIONS}.
 *
 * @param options - Per-route webhook validation overrides.
 *
 * @example Protect a single route
 * ```ts
 * @Post('webhooks/sms')
 * @TwilioWebhook()
 * handleIncomingSms(@Body() body: Record<string, string>) {
 *   // Reached only if the Twilio signature verified.
 * }
 * ```
 *
 * @example Validate against a subaccount token, behind a proxy
 * ```ts
 * @Post('webhooks/billing')
 * @TwilioWebhook({
 *   authToken: process.env.TWILIO_BILLING_AUTH_TOKEN,
 *   url: 'https://api.example.com/webhooks/billing',
 * })
 * handleBilling() {}
 * ```
 */
export function TwilioWebhook(
  options: TwilioWebhookOptions = {}
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(TWILIO_WEBHOOK_OPTIONS, options),
    UseGuards(TwilioWebhookGuard)
  );
}
