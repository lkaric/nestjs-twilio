import { Injectable } from '@nestjs/common';
import { InjectTwilio, getTwilioClientToken, type TwilioClient } from 'nestjs-twilio';

@Injectable()
export class BillingService {
  // Resolves the client registered by TwilioModule.forFeature('billing'), not
  // the default one. The name must match the registration.
  constructor(@InjectTwilio('billing') private readonly twilio: TwilioClient) {}

  describeAccount(): string {
    return this.twilio.accountSid;
  }

  /**
   * The DI token behind the decorator. Useful when wiring a provider manually
   * rather than through the decorator.
   */
  static token(): symbol {
    return getTwilioClientToken('billing');
  }
}
