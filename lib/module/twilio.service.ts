import { Inject, Injectable } from '@nestjs/common';

import { createTwilioClient, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from '../utils/index.js';

import type { TwilioClient } from '../utils/index.js';

/**
 * Service providing access to the Twilio SDK client.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class SmsService {
 *   constructor(private readonly twilio: TwilioService) {}
 *
 *   async sendSms(to: string, body: string) {
 *     return this.twilio.client.messages.create({
 *       from: process.env.TWILIO_PHONE_NUMBER,
 *       to,
 *       body,
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class TwilioService {
  private readonly twilioClient: TwilioClient;

  /**
   * @param options - Module options containing account credentials
   */
  constructor(@Inject(MODULE_OPTIONS_TOKEN) private options: typeof OPTIONS_TYPE) {
    this.twilioClient = createTwilioClient(this.options);
  }

  /**
   * Access the underlying Twilio SDK client.
   * Use this to call any Twilio API method.
   *
   * @example
   * ```ts
   * const message = await this.twilioService.client.messages.create({
   *   from: '+1234567890',
   *   to: '+0987654321',
   *   body: 'Hello!',
   * });
   * ```
   */
  public get client(): TwilioClient {
    return this.twilioClient;
  }
}
