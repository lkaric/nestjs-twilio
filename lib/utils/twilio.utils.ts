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

  if (!options.accountSid.startsWith('AC')) {
    throw new BadRequestException('TwilioModule: accountSid should start with "AC"');
  }

  const hasAuthToken = Boolean(options.authToken) && typeof options.authToken === 'string';
  const hasApiKey = Boolean(options.apiKey) && typeof options.apiKey === 'string';

  if (!hasAuthToken && !hasApiKey) {
    throw new BadRequestException(
      'TwilioModule: either authToken, or apiKey together with apiSecret, is required'
    );
  }

  if (hasApiKey) {
    // API key authentication signs with the key's secret. Treating the secret
    // as optional is what let it be dropped silently, producing a client that
    // failed every request.
    if (!options.apiSecret || typeof options.apiSecret !== 'string') {
      throw new BadRequestException('TwilioModule: apiSecret is required when apiKey is provided');
    }

    if (!options.apiKey?.startsWith('SK')) {
      throw new BadRequestException('TwilioModule: apiKey should start with "SK"');
    }
  }
}

/** Auth-token credential fields, which are an alternative to the API key pair. */
const AUTH_TOKEN_FIELDS = ['authToken'] as const;

/** API key credential fields, which are an alternative to the auth token. */
const API_KEY_FIELDS = ['apiKey', 'apiSecret'] as const;

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
 * Credentials are the exception: `authToken` and `apiKey`/`apiSecret` are
 * alternative *authentication modes*, not independent settings, so they are
 * inherited as a unit. A client that supplies either mode drops the inherited
 * other one. Merging them field-by-field means an inherited `authToken` wins
 * over an explicitly configured `apiKey` — making it impossible to register an
 * API-key client beneath an auth-token root.
 *
 * @param shared - Options from `forRoot()`, or undefined when none is registered.
 * @param overrides - The named client's own options.
 *
 * @example Transport settings inherit
 * ```ts
 * mergeClientOptions(
 *   { accountSid: 'ACroot', authToken: 'r', region: 'ie1' },
 *   { name: 'billing', accountSid: 'ACbilling', authToken: 'b', region: undefined },
 * );
 * // => { accountSid: 'ACbilling', authToken: 'b', region: 'ie1' }
 * ```
 *
 * @example Credentials do not mix modes
 * ```ts
 * mergeClientOptions(
 *   { accountSid: 'ACroot', authToken: 'r', region: 'ie1' },
 *   { name: 'realtime', apiKey: 'SKxxx', apiSecret: 's' },
 * );
 * // => { accountSid: 'ACroot', apiKey: 'SKxxx', apiSecret: 's', region: 'ie1' }
 * //    the inherited authToken is dropped, not preferred over the API key
 * ```
 */
export function mergeClientOptions<S extends object, O extends object>(
  shared: S | undefined,
  overrides: O
): S & O {
  const merged: Record<string, unknown> = { ...(shared ?? {}) };
  const supplied = new Set(
    Object.entries(overrides)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  );

  const replacesAuthMode = (fields: readonly string[]): boolean =>
    fields.some((field) => supplied.has(field));

  // Drop the inherited credentials of whichever mode this client is not using,
  // so an inherited value cannot outrank an explicitly configured one.
  if (replacesAuthMode(API_KEY_FIELDS)) {
    for (const field of AUTH_TOKEN_FIELDS) delete merged[field];
  }

  if (replacesAuthMode(AUTH_TOKEN_FIELDS)) {
    for (const field of API_KEY_FIELDS) delete merged[field];
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'name') continue;
    if (value !== undefined) merged[key] = value;
  }

  return merged as S & O;
}

/**
 * Build a Twilio SDK client from module options.
 *
 * The SDK constructor is `new Twilio(username, password, opts)`. Which values
 * those are depends on the authentication mode:
 *
 * - **Auth token**: username is the Account SID, password the auth token.
 * - **API key**: username is the API Key SID (`SK…`), password is the key's
 *   secret, and the Account SID is supplied through `opts.accountSid`.
 *
 * Module-level keys the SDK has no concept of are stripped; everything else is
 * forwarded as `ClientOpts`.
 *
 * @throws BadRequestException When required credentials are missing or malformed.
 *
 * @example Auth token
 * ```ts
 * createTwilioClient({ accountSid: 'ACxxx', authToken: 'token', region: 'ie1' });
 * ```
 *
 * @example API key, which is also what access tokens are signed with
 * ```ts
 * createTwilioClient({ accountSid: 'ACxxx', apiKey: 'SKxxx', apiSecret: 'secret' });
 * ```
 */
export function createTwilioClient(options: typeof OPTIONS_TYPE): TwilioClient {
  validateTwilioOptions(options);

  const {
    accountSid,
    // Credentials are constructor arguments, never ClientOpts.
    authToken,
    apiKey,
    apiSecret,
    // Module-level settings the Twilio SDK has no concept of. Without this
    // they were forwarded into ClientOpts and reached the SDK constructor.
    webhookAuthToken: _webhookAuthToken,
    webhookUrl: _webhookUrl,
    ...clientOpts
  } = options;

  // Prefer the auth token when both are supplied, matching the precedence the
  // Twilio CLI and the SDK's own environment-variable handling use.
  if (authToken) {
    return new twilio.Twilio(accountSid, authToken, { ...clientOpts, accountSid });
  }

  // validateTwilioOptions has already established both are present.
  return new twilio.Twilio(apiKey, apiSecret, { ...clientOpts, accountSid });
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
