import { Inject, Injectable } from '@nestjs/common';

import {
  createTwilioClient,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from '../utils';

import type { TwilioClient } from '../utils';

@Injectable()
export class TwilioService {
  private readonly twilioSdk: TwilioClient;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: typeof OPTIONS_TYPE,
  ) {
    this.twilioSdk = createTwilioClient(this.options);
  }

  public get client(): TwilioClient {
    return this.twilioSdk;
  }
}
