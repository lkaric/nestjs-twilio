/**
 * Smoke test: verify that all public exports are accessible and have correct types.
 */
import {
  TwilioModule,
  TwilioService,
  InjectTwilio,
  getTwilioClientToken,
  TwilioWebhookGuard,
  TwimlInterceptor,
  TwilioExceptionFilter,
} from '../index.js';

describe('Barrel exports', () => {
  it('should export TwilioModule', () => {
    expect(TwilioModule).toBeDefined();
    expect(typeof TwilioModule.forRoot).toBe('function');
  });

  it('should export TwilioService', () => {
    expect(TwilioService).toBeDefined();
  });

  it('should export InjectTwilio decorator', () => {
    expect(InjectTwilio).toBeDefined();
    expect(typeof InjectTwilio).toBe('function');
  });

  it('should export getTwilioClientToken utility', () => {
    expect(getTwilioClientToken).toBeDefined();
    expect(typeof getTwilioClientToken).toBe('function');
    expect(typeof getTwilioClientToken()).toBe('symbol');
  });

  it('should export webhook guard', () => {
    expect(TwilioWebhookGuard).toBeDefined();
  });

  it('should export TwiML interceptor', () => {
    expect(TwimlInterceptor).toBeDefined();
  });

  it('should export exception filter', () => {
    expect(TwilioExceptionFilter).toBeDefined();
  });
});
