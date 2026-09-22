import { Test, TestingModule } from '@nestjs/testing';
import { Twilio } from 'twilio';

import { TwilioModule, TwilioService } from '../module/index.js';

describe('TwilioService', () => {
  let module: TestingModule;
  let service: TwilioService;

  const testConfig = {
    accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    authToken: 'test_auth_token_value',
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TwilioModule.forRoot(testConfig)],
    }).compile();

    service = module.get(TwilioService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('synchronous initialization', () => {
    it('should create a service with Twilio client', () => {
      expect(service).toBeDefined();
      expect(service.client).toBeInstanceOf(Twilio);
    });

    it('should have correct account SID', () => {
      expect(service.client.accountSid).toBe(testConfig.accountSid);
    });

    it('should return same client on multiple calls', () => {
      const client1 = service.client;
      const client2 = service.client;
      expect(client1).toBe(client2);
    });
  });

  describe('asynchronous initialization', () => {
    it('should support forRootAsync', async () => {
      const asyncModule = await Test.createTestingModule({
        imports: [
          TwilioModule.forRootAsync({
            useFactory: async () => testConfig,
          }),
        ],
      }).compile();

      const asyncService = asyncModule.get(TwilioService);
      expect(asyncService.client).toBeInstanceOf(Twilio);
      expect(asyncService.client.accountSid).toBe(testConfig.accountSid);
      await asyncModule.close();
    });
  });

  describe('global module', () => {
    it('should support global module registration', async () => {
      const globalModule = await Test.createTestingModule({
        imports: [TwilioModule.forRoot({ ...testConfig, isGlobal: true })],
      }).compile();

      const globalService = globalModule.get(TwilioService);
      expect(globalService.client).toBeInstanceOf(Twilio);
      await globalModule.close();
    });
  });
});
