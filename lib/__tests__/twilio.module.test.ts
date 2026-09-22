import { Test } from '@nestjs/testing';

import { TwilioModule, TwilioService } from '../module/index.js';

describe('TwilioModule', () => {
  const config = {
    accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    authToken: 'auth_token_test_value',
  };

  describe('forRoot', () => {
    let twilioService: TwilioService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [TwilioModule.forRoot(config)],
      }).compile();

      twilioService = module.get(TwilioService);
    });

    it('should provide twilio service', () => {
      expect(twilioService).toBeDefined();
    });

    it('should provide twilio client', () => {
      expect(twilioService.client).toBeDefined();
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

    it('should provide twilio service', () => {
      expect(twilioService).toBeDefined();
    });

    it('should provide twilio client', () => {
      expect(twilioService.client).toBeDefined();
    });
  });
});
