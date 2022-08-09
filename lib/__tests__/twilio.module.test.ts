import { Test } from '@nestjs/testing';

import { TwilioModule, TwilioService } from '../module';

import { OPTIONS_TYPE } from '../utils';

describe('TwiliModule', () => {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    TWILIO_TARGET_PHONE_NUMBER,
  } = process.env;

  if (!TWILIO_PHONE_NUMBER)
    throw new Error('No Twilio phone number defined in `.env`!');
  if (!TWILIO_TARGET_PHONE_NUMBER)
    throw new Error('No testing target phone number defined in `.env`!');

  const config: typeof OPTIONS_TYPE = {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
  };

  describe('forRoot', () => {
    let twilioService: TwilioService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [TwilioModule.forRoot(config)],
      }).compile();

      twilioService = module.get(TwilioService);
    });

    it('should provide sentry client', () => {
      expect(twilioService).toBeDefined();
    });

    it('should send a test sms to the phone number defined in env', async () => {
      const response = await twilioService.client.messages.create({
        body: 'Automated testing of https://www.github.com/rejvban/nestjs-twilio forRoot',
        from: TWILIO_PHONE_NUMBER,
        to: TWILIO_TARGET_PHONE_NUMBER,
      });

      expect(response).toBeDefined();
    });
  });

  describe('forRootAsync with useFactory', () => {
    let twilioService: TwilioService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [
          TwilioModule.forRootAsync({
            useFactory: () => config,
          }),
        ],
      }).compile();

      twilioService = module.get(TwilioService);
    });

    it('should provide sentry client', () => {
      expect(twilioService).toBeDefined();
    });

    it('should send a test sms to the phone number defined in env', async () => {
      const response = await twilioService.client.messages.create({
        body: 'Automated testing of https://www.github.com/rejvban/nestjs-twilio forRootAsync with useFactory',
        from: TWILIO_PHONE_NUMBER,
        to: TWILIO_TARGET_PHONE_NUMBER,
      });

      expect(response).toBeDefined();
    });
  });
});
