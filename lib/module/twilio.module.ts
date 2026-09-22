import { DynamicModule, Module, Provider, Type } from '@nestjs/common';

import { ConfigurableModuleClass } from '../utils/twilio.module-definition.js';
import { createTwilioClient, getTwilioClientToken } from '../utils/index.js';

import type { TwilioModuleOptions } from '../utils/index.js';
import { TwilioService } from './twilio.service.js';

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
  providers: [TwilioService],
  exports: [TwilioService],
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
      module: TwilioModule,
      providers: [provider],
      exports: [provider],
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
      useFactory: options.useFactory,
      inject: options.inject,
    };

    return {
      module: TwilioModule,
      imports: options.imports,
      providers: [provider],
      exports: [provider],
    };
  }
}
