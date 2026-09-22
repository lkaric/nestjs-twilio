import type { Twilio, ClientOpts } from 'twilio';

/**
 * The Twilio SDK client instance this module provides.
 *
 * An alias for the SDK's `Twilio` type, re-exported so consumers can annotate
 * injected clients without importing from `twilio` directly.
 *
 * @example
 * ```ts
 * import { InjectTwilio, type TwilioClient } from 'nestjs-twilio';
 *
 * @Injectable()
 * export class SmsService {
 *   constructor(@InjectTwilio() private readonly client: TwilioClient) {}
 *
 *   send(to: string, body: string) {
 *     return this.client.messages.create({ to, body, from: '+1234567890' });
 *   }
 * }
 * ```
 */
export type TwilioClient = Twilio;

/**
 * Twilio SDK client configuration options.
 *
 * @example
 * ```ts
 * const options: TwilioClientOpts = {
 *   accountSid: 'ACxxxxxxx',
 *   authToken: 'auth_token_here',
 *   region: 'ie1',
 *   edge: 'sydney',
 * };
 * ```
 */
export interface TwilioClientOpts extends ClientOpts {
  /**
   * Twilio Account SID. Required.
   */
  accountSid: string;

  /**
   * Twilio Auth Token. Required when using auth-token authentication.
   */
  authToken?: string;

  /**
   * Twilio API Key SID. Used in place of authToken for certain operations.
   */
  apiKey?: string;

  /**
   * Twilio API Key Secret. Required if apiKey is provided.
   */
  apiSecret?: string;
}

/**
 * A named client registered with `TwilioModule.registerClient()`.
 *
 * Every field except `name` is optional: anything omitted is inherited from
 * the options given to `forRoot()`. A field set to `undefined` also inherits.
 * Only a defined value overrides. Supply full credentials when no `forRoot()`
 * is registered.
 *
 * @example
 * ```ts
 * // Inherits region and edge from forRoot; overrides the credentials.
 * TwilioModule.registerClient({
 *   name: 'billing',
 *   accountSid: process.env.TWILIO_BILLING_ACCOUNT_SID,
 *   authToken: process.env.TWILIO_BILLING_AUTH_TOKEN,
 * });
 * ```
 */
export interface TwilioClientRegistration extends Partial<TwilioModuleOptions> {
  /**
   * Identifies the client. Inject it with `@InjectTwilio(name)`, or resolve
   * its token with `getTwilioClientToken(name)`. Matched case-insensitively.
   */
  name: string;
}

/**
 * Supplies options for a named client from a class, for
 * `registerClientAsync({ useClass })` or `registerClientAsync({ useExisting })`.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class BillingTwilioConfig implements TwilioClientOptionsFactory {
 *   constructor(private readonly config: ConfigService) {}
 *
 *   createTwilioClientOptions(): Partial<TwilioModuleOptions> {
 *     return { accountSid: this.config.getOrThrow('BILLING_SID') };
 *   }
 * }
 * ```
 */
export interface TwilioClientOptionsFactory {
  createTwilioClientOptions(): Partial<TwilioModuleOptions> | Promise<Partial<TwilioModuleOptions>>;
}

/**
 * Options accepted by `forRoot()` and `forRootAsync()`.
 *
 * Extends {@link TwilioClientOpts}, so every Twilio SDK client option is a
 * top-level key. In v4 these were nested under `options`; see MIGRATION.md.
 *
 * @example
 * ```ts
 * const options: TwilioModuleOptions = {
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   // Any twilio ClientOpts key, flat:
 *   region: 'ie1',
 *   edge: 'dublin',
 *   // Webhook validation defaults, overridable per route:
 *   webhookUrl: 'https://api.example.com',
 * };
 * ```
 */
export interface TwilioModuleOptions extends TwilioClientOpts {
  /**
   * Default auth token for webhook validation. Can be overridden per-route.
   */
  webhookAuthToken?: string;

  /**
   * Default public URL for webhook validation (when behind a proxy).
   */
  webhookUrl?: string;
}
