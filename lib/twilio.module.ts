import { Module, DynamicModule } from '@nestjs/common';
import { TwilioCoreModule } from './twilio-core.module';
import { TwilioModuleOptions, TwilioModuleAsyncOptions } from './interfaces';

@Module({})
export class TwilioModule {
  public static forRoot(options: TwilioModuleOptions): DynamicModule {
    return {
      module: TwilioModule,
      imports: [TwilioCoreModule.forRoot(options)],
    };
  }

  public static forRootAsync(options: TwilioModuleAsyncOptions): DynamicModule {
    return {
      module: TwilioModule,
      imports: [TwilioCoreModule.forRootAsync(options)],
    };
  }
}
