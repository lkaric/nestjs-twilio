import { Module } from '@nestjs/common';

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from '../utils/twilio.module-definition.js';
import { createTwilioClient, getTwilioClientToken, mergeClientOptions } from '../utils/index.js';
import { TWILIO_WEBHOOK_OPTIONS } from '../webhook/twilio-webhook.options.js';
import { TwilioService } from './twilio.service.js';
import { TwilioTokenService } from '../token/twilio-token.service.js';

import type { DynamicModule, ModuleMetadata, Provider, Type } from '@nestjs/common';
import type { ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } from '../utils/twilio.module-definition.js';
import type {
  TwilioClientOptionsFactory,
  TwilioClientRegistration,
  TwilioModuleOptions,
} from '../utils/index.js';
import type { TwilioWebhookOptions } from '../webhook/twilio-webhook.options.js';

/**
 * Options accepted by {@link TwilioModule.registerClientAsync}.
 *
 * Mirrors the shape Nest's own generated `*Async` methods accept, so the async
 * API is the same whether you are configuring the root or a named client.
 * Choose exactly one of `useFactory`, `useClass` or `useExisting`.
 */
export interface TwilioClientAsyncRegistration extends Pick<ModuleMetadata, 'imports'> {
  /** Identifies the client. Inject it with `@InjectTwilio(name)`. */
  name: string;
  /** Returns the client's options. May be async. */
  useFactory?: (
    ...args: never[]
  ) => Partial<TwilioModuleOptions> | Promise<Partial<TwilioModuleOptions>>;
  /** Dependencies passed to `useFactory`, in parameter order. */
  inject?: NonNullable<Provider extends { inject?: infer I } ? I : never>;
  /** A class Nest instantiates to produce the options. */
  useClass?: Type<TwilioClientOptionsFactory>;
  /** An already-registered provider that produces the options. */
  useExisting?: Type<TwilioClientOptionsFactory>;
}

/**
 * Nest identifies a dynamic module by the class named in its `module` property,
 * and treats two dynamic modules naming the same class as one, merging their
 * providers. A named client must therefore have its own module class, or its
 * providers would replace the ones `forRoot()` registered.
 *
 * Cached by name so registering the same client twice stays idempotent.
 */
const clientModuleClasses = new Map<string, Type<unknown>>();

function getClientModuleClass(name: string): Type<unknown> {
  const key = name.toLowerCase();
  const cached = clientModuleClasses.get(key);
  if (cached) return cached;

  const clientModule = class TwilioClientModule {};
  Object.defineProperty(clientModule, 'name', { value: `TwilioClientModule(${name})` });
  Module({})(clientModule);

  clientModuleClasses.set(key, clientModule);
  return clientModule;
}

/** Builds the provider that resolves a named client, merging shared options. */
function createClientProvider(
  name: string,
  resolve: (shared: typeof OPTIONS_TYPE | undefined) => unknown,
  inject: unknown[]
): Provider {
  return {
    provide: getTwilioClientToken(name),
    useFactory: resolve,
    // Optional: a named client may be registered without any forRoot(), in
    // which case it must carry full credentials of its own.
    inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }, ...inject],
  } as Provider;
}

/**
 * NestJS module for injecting Twilio SDK clients.
 *
 * `forRoot()` configures the default client and the options every named client
 * inherits. `registerClient()` adds further clients (typically subaccounts)
 * which inherit those options and override what they need.
 *
 * The module registers globally, as `TypeOrmCoreModule`, Mongoose's core module
 * and `BullModule.forRoot()` all do. Importing it once in the root module makes
 * `TwilioService` and every client available application-wide.
 *
 * @example Synchronous registration
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
 * @example Asynchronous registration
 * ```ts
 * TwilioModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     accountSid: config.getOrThrow('TWILIO_ACCOUNT_SID'),
 *     authToken: config.getOrThrow('TWILIO_AUTH_TOKEN'),
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 *
 * @example Shared transport settings, per-subaccount credentials
 * ```ts
 * TwilioModule.forRoot({ accountSid, authToken, region: 'ie1', edge: 'dublin' }),
 * // Inherits region and edge; overrides the credentials.
 * TwilioModule.registerClient({ name: 'billing', accountSid: '…', authToken: '…' }),
 * ```
 */
@Module({
  providers: [
    TwilioService,
    {
      // `@InjectTwilio()` with no name resolves this token. Deriving it from
      // TwilioService rather than building a second client keeps a single
      // instance (one connection pool, one set of credentials) whichever
      // injection style a consumer picks.
      provide: getTwilioClientToken(),
      useFactory: (service: TwilioService) => service.client,
      inject: [TwilioService],
    },
    {
      // Surfaces the module-level webhook settings to TwilioWebhookGuard.
      // Without this the guard has no auth token and rejects every request,
      // even when webhookAuthToken was configured on forRoot().
      provide: TWILIO_WEBHOOK_OPTIONS,
      useFactory: (options: typeof OPTIONS_TYPE): TwilioWebhookOptions => ({
        // Webhooks are normally signed with the same credentials the client
        // uses, so fall back to authToken rather than making consumers repeat it.
        authToken: options.webhookAuthToken ?? options.authToken,
        url: options.webhookUrl,
      }),
      inject: [MODULE_OPTIONS_TOKEN],
    },
    TwilioTokenService,
  ],
  exports: [TwilioService, getTwilioClientToken(), TWILIO_WEBHOOK_OPTIONS, TwilioTokenService],
})
export class TwilioModule extends ConfigurableModuleClass {
  /**
   * Configure the default client and the options named clients inherit.
   *
   * @param options - Credentials plus any Twilio SDK client option, flat.
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.asGlobalRoot(super.forRoot(options));
  }

  /**
   * Configure the default client asynchronously.
   *
   * Accepts `useFactory`, `useClass` or `useExisting`, along with `imports`
   * and `inject`.
   */
  static override forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.asGlobalRoot(super.forRootAsync(options));
  }

  /**
   * Register an additional named client, typically a subaccount.
   *
   * Options omitted here are inherited from `forRoot()`; a defined value
   * overrides. A key set to `undefined` inherits rather than clearing, so
   * reading configuration from possibly-unset environment variables is safe.
   *
   * Works without `forRoot()`, in which case the registration must carry full
   * credentials.
   *
   * @example
   * ```ts
   * TwilioModule.registerClient({
   *   name: 'billing',
   *   accountSid: process.env.TWILIO_BILLING_ACCOUNT_SID,
   *   authToken: process.env.TWILIO_BILLING_AUTH_TOKEN,
   * })
   * ```
   */
  static registerClient(options: TwilioClientRegistration): DynamicModule {
    const token = getTwilioClientToken(options.name);

    return {
      module: getClientModuleClass(options.name),
      providers: [
        createClientProvider(
          options.name,
          (shared) =>
            createTwilioClient(mergeClientOptions(shared, options) as typeof OPTIONS_TYPE),
          []
        ),
      ],
      exports: [token],
    };
  }

  /**
   * Register an additional named client, resolving its options through DI.
   *
   * @example
   * ```ts
   * TwilioModule.registerClientAsync({
   *   name: 'billing',
   *   imports: [ConfigModule],
   *   useFactory: (config: ConfigService) => ({
   *     accountSid: config.getOrThrow('TWILIO_BILLING_ACCOUNT_SID'),
   *     authToken: config.getOrThrow('TWILIO_BILLING_AUTH_TOKEN'),
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static registerClientAsync(options: TwilioClientAsyncRegistration): DynamicModule {
    const token = getTwilioClientToken(options.name);
    const providers: Provider[] = [];

    if (options.useClass) {
      providers.push({ provide: options.useClass, useClass: options.useClass });
    }

    const factoryClass = options.useClass ?? options.useExisting;

    const provider = factoryClass
      ? createClientProvider(
          options.name,
          async (shared, factory?: TwilioClientOptionsFactory) =>
            createTwilioClient(
              mergeClientOptions(shared, {
                ...(await factory!.createTwilioClientOptions()),
                name: options.name,
              }) as typeof OPTIONS_TYPE
            ),
          [factoryClass]
        )
      : createClientProvider(
          options.name,
          async (shared, ...args: never[]) =>
            createTwilioClient(
              mergeClientOptions(shared, {
                ...(await options.useFactory!(...args)),
                name: options.name,
              }) as typeof OPTIONS_TYPE
            ),
          options.inject ?? []
        );

    providers.push(provider);

    return {
      module: getClientModuleClass(options.name),
      imports: options.imports,
      providers,
      exports: [token],
    };
  }

  /**
   * Named clients are registered as their own modules, so the shared options
   * from `forRoot()` are only reachable if the root is global, for the same
   * reason `BullModule.forRoot()`, `TypeOrmCoreModule` and Mongoose's core module are.
   * Exporting the options token is what lets a client module inject it.
   */
  private static asGlobalRoot(definition: DynamicModule): DynamicModule {
    return {
      ...definition,
      global: true,
      exports: [...(definition.exports ?? []), MODULE_OPTIONS_TOKEN],
    };
  }
}
