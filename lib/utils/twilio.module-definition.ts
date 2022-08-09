import { ConfigurableModuleBuilder } from '@nestjs/common';

import type { TwilioModuleOptions } from './twilio.interface';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<TwilioModuleOptions>()
  .setClassMethodName('forRoot')
  .build();
