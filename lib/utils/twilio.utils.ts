import { TwilioClient } from './twilio.interface';
import { OPTIONS_TYPE } from './twilio.module-definition';

import { Twilio } from 'twilio';

export function createTwilioClient({
  accountSid,
  authToken,
  options,
}: typeof OPTIONS_TYPE): TwilioClient {
  const client = new Twilio(accountSid, authToken, options);

  return client;
}
