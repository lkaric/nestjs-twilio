import { ConfigurableModuleBuilder } from '@nestjs/common';

import { ExtraConfiguration, TwilioModuleOptions } from './twilio.interface';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<TwilioModuleOptions>()
  .setExtras<ExtraConfiguration>({ isGlobal: false }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .setClassMethodName('forRoot')
  .build();
