import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { InjectTwilio } from '../common';
import { TwilioClient, TwilioModuleOptions } from '../interfaces';
import { TwilioModule } from '../';

describe('InjectTwilio', () => {
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

  const config: TwilioModuleOptions = {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
  };

  let module: TestingModule;

  @Injectable()
  class InjectableService {
    public constructor(@InjectTwilio() public readonly client: TwilioClient) {}
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TwilioModule.forRoot(config)],
      providers: [InjectableService],
    }).compile();
  });

  describe('when decorating a class constructor parameter', () => {
    it('should inject twilio client', () => {
      const testService = module.get(InjectableService);

      expect(testService).toHaveProperty('client');
    });
  });

  describe('send a test sms', () => {
    it('should send a test sms to the phone number defined in env', async () => {
      const testService = module.get(InjectableService);
      const response = await testService.client.messages.create({
        body:
          'Automated testing of https://www.github.com/rejvban/nestjs-twilio',
        from: TWILIO_PHONE_NUMBER,
        to: TWILIO_TARGET_PHONE_NUMBER,
      });

      expect(response).toBeDefined();
    });
  });
});
