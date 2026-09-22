import { BadRequestException } from '@nestjs/common';
// `twilio` is CommonJS. A named value import type-checks — the SDK declares
// `export =` over a namespace — but throws under Node's ESM loader, because
// cjs-module-lexer cannot detect those names statically. A default import
// always yields `module.exports`, so it is interop-safe in both builds.
import twilio from 'twilio';

import type { TwilioClient } from './twilio.interface.js';
import { OPTIONS_TYPE } from './twilio.module-definition.js';

/**
 * Validates Twilio module options at bootstrap.
 *
 * Runs automatically inside {@link createTwilioClient} and during module
 * initialisation. Call it directly only when you want to fail earlier — while
 * loading configuration, for example.
 *
 * Error messages name the offending field and never include its value, so a
 * failure is safe to log.
 *
 * @param options - The options that would be passed to `forRoot()`.
 * @throws BadRequestException When a required field is missing or malformed.
 *
 * @example
 * ```ts
 * // Fail fast in a config factory, before Nest builds the module.
 * const options = {
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 * };
 *
 * validateTwilioOptions(options);
 * // Throws: "TwilioModule: accountSid should start with \"AC\""
 * ```
 */
export function validateTwilioOptions(options: typeof OPTIONS_TYPE): void {
  if (!options.accountSid || typeof options.accountSid !== 'string') {
    throw new BadRequestException('TwilioModule: accountSid is required and must be a string');
  }

  // Must have either authToken or apiKey (apiSecret optional for some flows)
  const hasAuthToken = options.authToken && typeof options.authToken === 'string';
  const hasApiKey = options.apiKey && typeof options.apiKey === 'string';

  if (!hasAuthToken && !hasApiKey) {
    throw new BadRequestException('TwilioModule: either authToken or apiKey is required');
  }

  // Sanity check on Account SID format
  if (!options.accountSid.startsWith('AC')) {
    throw new BadRequestException('TwilioModule: accountSid should start with "AC"');
  }
}

/**
 * Factory function to create a Twilio SDK client.
 *
 * @example
 * ```ts
 * const client = createTwilioClient({
 *   accountSid: 'ACxxxxxxx',
 *   authToken: 'auth_token_here',
 * });
 * ```
 */
export function createTwilioClient(options: typeof OPTIONS_TYPE): TwilioClient {
  validateTwilioOptions(options);

  // Use authToken if available, otherwise use apiKey
  const credential = options.authToken || options.apiKey || '';

  // Extract Twilio-specific config and remove auth fields (they go to constructor)
  const {
    accountSid,
    authToken: _authToken,
    apiKey: _apiKey,
    apiSecret: _apiSecret,
    ...clientOpts
  } = options;

  const client = new twilio.Twilio(accountSid, credential, clientOpts);
  return client;
}

/**
 * Resolve the dependency-injection token for a Twilio client.
 *
 * Backed by `Symbol.for`, so the same name always yields the *identical*
 * symbol. A plain `Symbol()` mints a fresh, unequal value on every call, which
 * silently breaks injection: the provider registers one token while the
 * consumer injects another, and Nest reports the dependency as missing.
 *
 * Names are matched case-insensitively, and the registry key is namespaced so
 * it cannot collide with symbols registered by other packages.
 *
 * @param name - The feature name passed to `forFeature()`. Omit for the
 * default client registered by `forRoot()`.
 *
 * @example
 * ```ts
 * // Equal across calls, and across module boundaries.
 * getTwilioClientToken('billing') === getTwilioClientToken('Billing'); // true
 *
 * // Inject a named client without the decorator.
 * @Inject(getTwilioClientToken('billing')) private readonly billing: TwilioClient
 * ```
 */
export function getTwilioClientToken(name?: string): symbol {
  const key = name ? `client:${name.toLowerCase()}` : 'client:default';
  return Symbol.for(`nestjs-twilio:${key}`);
}

export { OPTIONS_TYPE };
