import { Test } from '@nestjs/testing';
import { TWILIO_CONFIG_TOKEN } from '../common';
import {
  TwilioModuleOptions,
  TwilioOptionsFactory,
  TwilioClient,
} from '../interfaces';
import { TwilioModule } from '../twilio.module';

describe('TwiliModule', () => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

  const config: TwilioModuleOptions = {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
  };

  class TestService implements TwilioOptionsFactory {
    createTwilioOptions(): TwilioModuleOptions {
      return config;
    }
  }

  describe('forRoot', () => {
    it('should provide the sentry client', async () => {
      const module = await Test.createTestingModule({
        imports: [TwilioModule.forRoot(config)],
      }).compile();

      const sentry = module.get<TwilioModuleOptions>(TWILIO_CONFIG_TOKEN);

      expect(sentry).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    describe('when `useFactory` op is used', () => {
      it('should provide sentry client', async () => {
        const module = await Test.createTestingModule({
          imports: [
            TwilioModule.forRootAsync({
              useFactory: () => config,
            }),
          ],
        }).compile();

        const sentry = module.get<TwilioModuleOptions>(TWILIO_CONFIG_TOKEN);

        expect(sentry).toBeDefined();
      });
    });

    // describe('testing edgeCase', async () => {});
  });

  describe('when `useClass` option is used', () => {
    it('should provide sentry client', async () => {
      const module = await Test.createTestingModule({
        imports: [
          TwilioModule.forRootAsync({
            useClass: TestService,
          }),
        ],
      }).compile();

      const sentry = module.get<TwilioModuleOptions>(TWILIO_CONFIG_TOKEN);

      expect(sentry).toBeDefined();
    });
  });
});
