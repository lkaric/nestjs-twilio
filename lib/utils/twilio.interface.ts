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
 * Module-level configuration applied to the generated `DynamicModule`, rather
 * than injected into providers.
 *
 * `ConfigurableModuleBuilder` merges these keys into the single object passed
 * to `forRoot()`, but keeps them out of the options object your providers
 * receive — so module wiring never leaks into application code.
 *
 * @example
 * ```ts
 * // `isGlobal` configures the module; accountSid and authToken configure the client.
 * TwilioModule.forRoot({
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   isGlobal: true,
 * });
 * ```
 */
export interface TwilioModuleDefinitionExtras {
  /**
   * Make the module globally available. Default: false.
   * This is module-level config, not passed to injected providers.
   */
  isGlobal?: boolean;
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
