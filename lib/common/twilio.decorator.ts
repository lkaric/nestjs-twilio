import { Inject } from '@nestjs/common';
import { TwilioDecorator } from '../interfaces/twilio-decorator.interface';
import { TWILIO_CONFIG_TOKEN } from './twilio.constants';

export function InjectTwilio(): TwilioDecorator {
  return Inject(TWILIO_CONFIG_TOKEN);
}
