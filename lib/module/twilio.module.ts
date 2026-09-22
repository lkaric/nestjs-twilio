import { DynamicModule, Module, Provider, Type } from '@nestjs/common';

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from '../utils/twilio.module-definition.js';
import { createTwilioClient, getTwilioClientToken } from '../utils/index.js';
import { TWILIO_WEBHOOK_OPTIONS } from '../webhook/twilio-webhook.options.js';

import type { OPTIONS_TYPE } from '../utils/twilio.module-definition.js';
import type { TwilioModuleOptions } from '../utils/index.js';
import type { TwilioWebhookOptions } from '../webhook/twilio-webhook.options.js';
import { TwilioService } from './twilio.service.js';

/**
 * Nest identifies a dynamic module by the class in its `module` property. Two
 * `DynamicModule`s naming the same class are treated as one and their provider
 * sets are merged — so returning `TwilioModule` from `forFeature()` silently
 * replaced the providers `forRoot()` had registered, and `TwilioService` lost
 * the options token it injects.
 *
 * Each feature therefore gets its own anonymous module class, cached by name so
 * repeated registration of the same feature stays idempotent.
 */
const featureModuleClasses = new Map<string, Type<unknown>>();

function getFeatureModuleClass(name: string): Type<unknown> {
  const cached = featureModuleClasses.get(name);
  if (cached) return cached;

  const featureModule = class TwilioFeatureModule {};
  Object.defineProperty(featureModule, 'name', {
    value: `TwilioFeatureModule(${name})`,
  });

  featureModuleClasses.set(name, featureModule);
  return featureModule;
}

/**
 * NestJS dynamic module for injecting Twilio SDK clients.
 *
 * @example Synchronous registration:
 * ```ts
 * @Module({
 *   imports: [
 *     TwilioModule.forRoot({
 *       accountSid: process.env.TWILIO_ACCOUNT_SID,
 *       authToken: process.env.TWILIO_AUTH_TOKEN,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example Asynchronous registration:
 * ```ts
 * @Module({
 *   imports: [
 *     TwilioModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (config: ConfigService) => ({
 *         accountSid: config.get('TWILIO_ACCOUNT_SID'),
 *         authToken: config.get('TWILIO_AUTH_TOKEN'),
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [
    TwilioService,
    {
      // `@InjectTwilio()` with no name resolves this token. Deriving it from
      // TwilioService rather than building a second client keeps a single
      // instance — one connection pool, one set of credentials — no matter
      // which injection style a consumer picks.
      provide: getTwilioClientToken(),
      useFactory: (service: TwilioService) => service.client,
      inject: [TwilioService],
    },
    {
      // Surfaces the module-level webhook settings to TwilioWebhookGuard.
      // Without this the guard has no auth token and rejects every request,
      // even though `webhookAuthToken` was configured on forRoot().
      provide: TWILIO_WEBHOOK_OPTIONS,
      useFactory: (options: typeof OPTIONS_TYPE): TwilioWebhookOptions => ({
        // Webhooks are normally signed with the same credentials the client
        // uses, so fall back to authToken rather than forcing consumers to
        // repeat it.
        authToken: options.webhookAuthToken ?? options.authToken,
        url: options.webhookUrl,
      }),
      inject: [MODULE_OPTIONS_TOKEN],
    },
  ],
  exports: [TwilioService, getTwilioClientToken(), TWILIO_WEBHOOK_OPTIONS],
})
export class TwilioModule extends ConfigurableModuleClass {
  /**
   * Register a named Twilio client for multi-account/subaccount scenarios.
   *
   * Must be called after `forRoot()` or `forRootAsync()`.
   *
   * @param name - Unique name for this client
   * @param options - Twilio client configuration (overrides root config)
   *
   * @example
   * ```ts
   * @Module({
   *   imports: [
   *     TwilioModule.forRoot(rootConfig),
   *     TwilioModule.forFeature('billing', billingConfig),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forFeature(name: string, options: TwilioModuleOptions): DynamicModule {
    const clientToken = getTwilioClientToken(name);

    const provider: Provider = {
      provide: clientToken,
      useFactory: () => createTwilioClient(options),
    };

    return {
      module: getFeatureModuleClass(name),
      providers: [provider],
      exports: [clientToken],
    };
  }

  /**
   * Register a named Twilio client asynchronously.
   *
   * @param name - Unique name for this client
   * @param options - Async configuration options
   *
   * @example
   * ```ts
   * TwilioModule.forFeatureAsync('billing', {
   *   imports: [ConfigModule],
   *   useFactory: (config: ConfigService) => ({
   *     accountSid: config.get('TWILIO_BILLING_ACCOUNT_SID'),
   *     authToken: config.get('TWILIO_BILLING_AUTH_TOKEN'),
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forFeatureAsync(
    name: string,
    options: {
      useFactory: (...args: unknown[]) => TwilioModuleOptions | Promise<TwilioModuleOptions>;
      inject?: (string | symbol | Type<unknown>)[];
      imports?: (Type<unknown> | DynamicModule)[];
    }
  ): DynamicModule {
    const clientToken = getTwilioClientToken(name);

    const provider: Provider = {
      provide: clientToken,
      // The caller's factory yields options, not a client. Without this the
      // token would resolve to a plain options object and @InjectTwilio(name)
      // would hand callers something that is not a Twilio client.
      useFactory: async (...args: unknown[]) =>
        createTwilioClient(await options.useFactory(...args)),
      inject: options.inject,
    };

    return {
      module: getFeatureModuleClass(name),
      imports: options.imports,
      providers: [provider],
      exports: [clientToken],
    };
  }
}
