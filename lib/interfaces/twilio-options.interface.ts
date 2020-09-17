import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { Twilio } from 'twilio';

export interface TwilioModuleOptions {
  accountSid: string | undefined;
  authToken: string | undefined;
  options?: Twilio.TwilioClientOptions | undefined;
}

export interface TwilioOptionsFactory {
  createTwilioOptions(): Promise<TwilioModuleOptions> | TwilioModuleOptions;
}

export interface TwilioModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line
  inject?: any[];
  useClass?: Type<TwilioOptionsFactory>;
  useExisting?: Type<TwilioOptionsFactory>;
  useFactory?: (
    // eslint-disable-next-line
    ...args: any[]
  ) => Promise<TwilioModuleOptions> | TwilioModuleOptions;
}
