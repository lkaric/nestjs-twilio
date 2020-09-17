import { Global, Module, DynamicModule, Provider, Type } from '@nestjs/common';
import { createTwilioProviders } from './providers';
import {
  TwilioModuleOptions,
  TwilioModuleAsyncOptions,
  TwilioOptionsFactory,
} from './interfaces';
import {
  createTwilioClient,
  TWILIO_CONFIG_TOKEN,
  TWILIO_CONFIG_OPTIONS,
} from './common';

@Global()
@Module({})
export class TwilioCoreModule {
  public static forRoot(options: TwilioModuleOptions): DynamicModule {
    const provider = createTwilioProviders(options);

    return {
      exports: [provider],
      module: TwilioCoreModule,
      providers: [provider],
    };
  }

  public static forRootAsync(options: TwilioModuleAsyncOptions): DynamicModule {
    const provider: Provider = {
      inject: [TWILIO_CONFIG_OPTIONS],
      provide: TWILIO_CONFIG_TOKEN,
      useFactory: (options: TwilioModuleOptions) => createTwilioClient(options),
    };

    return {
      exports: [provider],
      imports: options.imports,
      module: TwilioCoreModule,
      providers: [...this.createAsyncProviders(options), provider],
    };
  }

  private static createAsyncProviders(
    options: TwilioModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    const useClass = options.useClass as Type<TwilioOptionsFactory>;

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: TwilioModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        inject: options.inject || [],
        provide: TWILIO_CONFIG_OPTIONS,
        useFactory: options.useFactory,
      };
    }

    const inject = [
      /* istanbul ignore next */
      (options.useClass || options.useExisting) as Type<TwilioOptionsFactory>,
    ];

    return {
      provide: TWILIO_CONFIG_OPTIONS,
      useFactory: async (optionsFactory: TwilioOptionsFactory) =>
        await optionsFactory.createTwilioOptions(),
      inject,
    };
  }
}
