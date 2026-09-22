import { Injectable, Logger } from '@nestjs/common';
import { InjectTwilio, type TwilioClient } from 'nestjs-twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // The raw SDK client, injected directly. TwilioService is also available if
  // you would rather depend on the wrapper and reach for `.client`.
  constructor(@InjectTwilio() private readonly twilio: TwilioClient) {}

  async send(to: string, body: string): Promise<string> {
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!from) {
      throw new Error('TWILIO_PHONE_NUMBER is not set.');
    }

    const message = await this.twilio.messages.create({ to, body, from });
    this.logger.log(`Queued message ${message.sid} to ${to}`);

    return message.sid;
  }

  /** Demonstrates that the injected client is the real SDK instance. */
  describeAccount(): string {
    return this.twilio.accountSid;
  }
}
