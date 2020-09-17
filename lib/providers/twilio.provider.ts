import { Provider } from '@nestjs/common';
import { TwilioModuleOptions } from '../interfaces';
import { TWILIO_CONFIG_TOKEN, createTwilioClient } from '../common';

export function createTwilioProviders(options: TwilioModuleOptions): Provider {
  return {
    provide: TWILIO_CONFIG_TOKEN,
    useValue: createTwilioClient(options),
  };
}
