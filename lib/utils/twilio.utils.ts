import { TwilioClient } from './twilio.interface';
import { OPTIONS_TYPE } from './twilio.module-definition';

import * as Twilio from 'twilio';

export function createTwilioClient(options: typeof OPTIONS_TYPE): TwilioClient {
  const client = Twilio.default(
    options.accountSid,
    options.authToken,
    options.options,
  );

  return client;
}
