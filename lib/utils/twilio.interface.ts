import type { Twilio, ClientOpts } from 'twilio';

export type TwilioClient = Twilio;

export interface ExtraConfiguration {
  isGlobal?: boolean;
}
export interface TwilioModuleOptions extends ExtraConfiguration {
  accountSid: string | undefined;
  authToken: string | undefined;
  options?: ClientOpts | undefined;
}
