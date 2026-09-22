import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from '../utils/index.js';

import { TwilioService } from './twilio.service.js';

@Module({
  providers: [TwilioService],
  exports: [TwilioService],
})
export class TwilioModule extends ConfigurableModuleClass {}
