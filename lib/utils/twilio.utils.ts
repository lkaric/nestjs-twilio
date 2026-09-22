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
 * Merge a named client's overrides onto the shared options from `forRoot()`.
 *
 * Only *defined* values override. A key that is present but `undefined`
 * inherits, rather than clearing the inherited value.
 *
 * This deliberately differs from the plain object spread `@nestjs/bullmq`
 * uses. The common way to configure a client is from the environment, and
 * `region: process.env.TWILIO_REGION` is `undefined` whenever that variable is
 * unset — under a plain spread that silently clears an inherited region and
 * sends traffic to the default edge. Nothing is lost by inheriting instead:
 * `region` and `edge` are named values, so returning one client to the default
 * is expressed by naming it (`region: 'us1'`) rather than by erasing it.
 *
 * @param shared - Options from `forRoot()`, or undefined when none is registered.
 * @param overrides - The named client's own options.
 *
 * @example
 * ```ts
 * mergeClientOptions(
 *   { accountSid: 'ACroot', authToken: 'r', region: 'ie1' },
 *   { name: 'billing', accountSid: 'ACbilling', authToken: 'b', region: undefined },
 * );
 * // => { accountSid: 'ACbilling', authToken: 'b', region: 'ie1' }
 * ```
 */
export function mergeClientOptions<S extends object, O extends object>(
  shared: S | undefined,
  overrides: O
): S & O {
  const merged: Record<string, unknown> = { ...(shared ?? {}) };

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'name') continue;
    if (value !== undefined) merged[key] = value;
  }

  return merged as S & O;
}

/**
 * Build a Twilio SDK client from module options.
 *
 * Credentials are passed to the constructor; module-level keys that the SDK
 * does not understand are stripped, and everything else is forwarded as
 * `ClientOpts`.
 *
 * @throws BadRequestException When required credentials are missing or malformed.
 *
 * @example
 * ```ts
 * const client = createTwilioClient({
 *   accountSid: 'ACxxxxxxx',
 *   authToken: 'auth_token_here',
 *   region: 'ie1',
 * });
 * ```
 */
export function createTwilioClient(options: typeof OPTIONS_TYPE): TwilioClient {
  validateTwilioOptions(options);

  const credential = options.authToken || options.apiKey || '';

  const {
    accountSid,
    // Credentials go to the constructor, not into ClientOpts.
    authToken: _authToken,
    apiKey: _apiKey,
    apiSecret: _apiSecret,
    // Module-level settings the Twilio SDK has no concept of. Without this
    // they were forwarded into ClientOpts and reached the SDK constructor.
    webhookAuthToken: _webhookAuthToken,
    webhookUrl: _webhookUrl,
    ...clientOpts
  } = options;

  return new twilio.Twilio(accountSid, credential, clientOpts);
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
 * @param name - The name passed to `registerClient()`. Omit for the
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
