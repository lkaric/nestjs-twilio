import { ConfigurableModuleBuilder } from '@nestjs/common';

import { TwilioModuleOptions, TwilioModuleDefinitionExtras } from './twilio.interface.js';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<TwilioModuleOptions>()
    .setExtras<TwilioModuleDefinitionExtras>({ isGlobal: false }, (definition, extras) => ({
      ...definition,
      global: extras.isGlobal,
    }))
    .setClassMethodName('forRoot')
    .build();
