import { Twilio } from 'twilio';

export type TwilioClient = Twilio;

export interface ExtraConfiguration {
  isGlobal?: boolean;
}
export interface TwilioModuleOptions extends ExtraConfiguration {
  accountSid: string | undefined;
  authToken: string | undefined;
  options?: Twilio.TwilioClientOptions | undefined;
}
