import type { Twilio, ClientOpts } from 'twilio';

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
 * Extra configuration applied to the module definition (not injected).
 * Separate from options to avoid leaking module-level config into providers.
 */
export interface TwilioModuleDefinitionExtras {
  /**
   * Make the module globally available. Default: false.
   * This is module-level config, not passed to injected providers.
   */
  isGlobal?: boolean;
}

/**
 * Module options for synchronous and asynchronous registration.
 * These are the options passed to `forRoot()` and `forRootAsync()`.
 *
 * Global availability is controlled via extras in `.forRoot({ isGlobal: true })`,
 * not via this options interface.
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
