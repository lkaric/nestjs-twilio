import { expectTypeOf } from 'vitest';

import type {
  TwilioCallDirection,
  TwilioCallStatus,
  TwilioCallStatusPayload,
  TwilioIncomingCallPayload,
  TwilioIncomingMessagePayload,
  TwilioMessageStatus,
  TwilioMessageStatusPayload,
} from '../webhook/twilio-webhook.payloads.js';

// These payloads are types only, so the contract worth defending is the shape
// itself: which fields are required, which are optional, and that every value
// is a string because Twilio posts form-encoded bodies.

describe('webhook payload types', () => {
  describe('TwilioIncomingMessagePayload', () => {
    it('requires the fields Twilio always sends', () => {
      expectTypeOf<TwilioIncomingMessagePayload>().toHaveProperty('MessageSid');
      expectTypeOf<TwilioIncomingMessagePayload>().toHaveProperty('AccountSid');
      expectTypeOf<TwilioIncomingMessagePayload>().toHaveProperty('From');
      expectTypeOf<TwilioIncomingMessagePayload>().toHaveProperty('To');
      expectTypeOf<TwilioIncomingMessagePayload>().toHaveProperty('Body');
    });

    it('types always-present fields as plain strings', () => {
      expectTypeOf<TwilioIncomingMessagePayload['MessageSid']>().toEqualTypeOf<string>();
      expectTypeOf<TwilioIncomingMessagePayload['Body']>().toEqualTypeOf<string>();
    });

    // Twilio posts application/x-www-form-urlencoded, so counts arrive as
    // strings. Typing them as numbers would be a lie that pushes a runtime
    // bug into consumer code.
    it('types counts as strings, not numbers', () => {
      expectTypeOf<TwilioIncomingMessagePayload['NumMedia']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TwilioIncomingMessagePayload['NumSegments']>().toEqualTypeOf<
        string | undefined
      >();
    });

    it('indexes media by position', () => {
      const payload = {
        MessageSid: 'SM1',
        AccountSid: 'AC1',
        From: '+15550001111',
        To: '+15550002222',
        Body: 'hello',
        NumMedia: '2',
        MediaUrl0: 'https://example.test/0',
        MediaContentType0: 'image/jpeg',
        MediaUrl1: 'https://example.test/1',
        MediaContentType1: 'image/png',
      } satisfies TwilioIncomingMessagePayload;

      expect(payload[`MediaUrl${1}`]).toBe('https://example.test/1');
      expect(payload[`MediaContentType${0}`]).toBe('image/jpeg');
    });

    it('accepts a message carrying only the required fields', () => {
      const minimal = {
        MessageSid: 'SM1',
        AccountSid: 'AC1',
        From: '+15550001111',
        To: '+15550002222',
        Body: '',
      } satisfies TwilioIncomingMessagePayload;

      expect(minimal.Body).toBe('');
    });

    it('carries the WhatsApp and location extras as optional strings', () => {
      const whatsapp = {
        MessageSid: 'SM1',
        AccountSid: 'AC1',
        From: 'whatsapp:+15550001111',
        To: 'whatsapp:+15550002222',
        Body: 'hi',
        ProfileName: 'Ada Lovelace',
        WaId: '15550001111',
        Forwarded: 'true',
        Latitude: '51.5132',
        Longitude: '-0.2198',
      } satisfies TwilioIncomingMessagePayload;

      expect(whatsapp.ProfileName).toBe('Ada Lovelace');
      // Booleans arrive as the strings 'true'/'false'.
      expectTypeOf(whatsapp.Forwarded).toEqualTypeOf<string>();
    });
  });

  describe('TwilioMessageStatusPayload', () => {
    it('constrains MessageStatus to the documented lifecycle values', () => {
      expectTypeOf<'delivered'>().toMatchTypeOf<TwilioMessageStatus>();
      expectTypeOf<'undelivered'>().toMatchTypeOf<TwilioMessageStatus>();
      expectTypeOf<'read'>().toMatchTypeOf<TwilioMessageStatus>();
      expectTypeOf<'queued'>().toMatchTypeOf<TwilioMessageStatus>();
      expectTypeOf<'scheduled'>().toMatchTypeOf<TwilioMessageStatus>();
    });

    it('types ErrorCode as a string, because Twilio sends it form-encoded', () => {
      expectTypeOf<TwilioMessageStatusPayload['ErrorCode']>().toEqualTypeOf<string | undefined>();
    });

    it('accepts a failed delivery callback', () => {
      const failure = {
        MessageSid: 'SM1',
        AccountSid: 'AC1',
        From: '+15550001111',
        MessageStatus: 'undelivered',
        ErrorCode: '30008',
      } satisfies TwilioMessageStatusPayload;

      expect(failure.MessageStatus).toBe('undelivered');
    });
  });

  describe('TwilioIncomingCallPayload', () => {
    it('constrains CallStatus and Direction', () => {
      expectTypeOf<'in-progress'>().toMatchTypeOf<TwilioCallStatus>();
      expectTypeOf<'no-answer'>().toMatchTypeOf<TwilioCallStatus>();
      expectTypeOf<'outbound-dial'>().toMatchTypeOf<TwilioCallDirection>();
    });

    it('accepts a call carrying only the required fields', () => {
      const call = {
        CallSid: 'CA1',
        AccountSid: 'AC1',
        From: 'client:charlie',
        To: '+15550002222',
        CallStatus: 'ringing',
        Direction: 'inbound',
      } satisfies TwilioIncomingCallPayload;

      expect(call.From).toBe('client:charlie');
    });
  });

  describe('TwilioCallStatusPayload', () => {
    it('extends the incoming-call parameters with completion fields', () => {
      const completed = {
        CallSid: 'CA1',
        AccountSid: 'AC1',
        From: '+15550001111',
        To: '+15550002222',
        CallStatus: 'completed',
        Direction: 'inbound',
        CallDuration: '42',
        RecordingSid: 'RE1',
      } satisfies TwilioCallStatusPayload;

      expect(completed.CallDuration).toBe('42');
      expectTypeOf<TwilioCallStatusPayload>().toMatchTypeOf<TwilioIncomingCallPayload>();
    });
  });
});
