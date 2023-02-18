import Twilio from 'twilio/lib/rest/Twilio';

import type { ClientOpts } from 'twilio/lib/base/BaseTwilio';

export type TwilioClient = Twilio;

export interface ExtraConfiguration {
  isGlobal?: boolean;
}
export interface TwilioModuleOptions extends ExtraConfiguration {
  accountSid: string | undefined;
  authToken: string | undefined;
  options?: ClientOpts | undefined;
}
