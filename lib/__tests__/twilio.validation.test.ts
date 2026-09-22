import { BadRequestException } from '@nestjs/common';

import { validateTwilioOptions } from '../utils/twilio.utils.js';

describe('validateTwilioOptions', () => {
  describe('accountSid validation', () => {
    it('should throw if accountSid is missing', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: '',
          authToken: 'token',
        } as any)
      ).toThrow(BadRequestException);
    });

    it('should throw if accountSid does not start with AC', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: 'XXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          authToken: 'token',
        } as any)
      ).toThrow(/should start with "AC"/);
    });

    it('should accept valid accountSid', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          authToken: 'token',
        } as any)
      ).not.toThrow();
    });
  });

  describe('credential validation', () => {
    it('should throw if neither authToken nor apiKey is provided', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        } as any)
      ).toThrow(/either authToken or apiKey is required/);
    });

    it('should accept authToken', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          authToken: 'test_token',
        } as any)
      ).not.toThrow();
    });

    it('should accept apiKey', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          apiKey: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        } as any)
      ).not.toThrow();
    });

    it('should accept both authToken and apiKey', () => {
      expect(() =>
        validateTwilioOptions({
          accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          authToken: 'test_token',
          apiKey: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        } as any)
      ).not.toThrow();
    });
  });

  describe('error messages', () => {
    it('never includes credentials in the error message', () => {
      const secret = 'super_secret_token_12345';
      type Options = Parameters<typeof validateTwilioOptions>[0];

      let message: string | undefined;

      try {
        validateTwilioOptions({ accountSid: '', authToken: secret } as unknown as Options);
      } catch (thrown: unknown) {
        message = (thrown as Error).message;
      }

      // Assert it actually threw, so a future change that stops validating
      // cannot make this test pass by doing nothing.
      expect(message).toBeDefined();
      expect(message).not.toContain(secret);
      // The field must still be named, or the error is not actionable.
      expect(message).toContain('accountSid');
    });
  });
});
