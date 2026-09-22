import { BadRequestException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import {
  isTwilioRestException,
  TwilioExceptionFilter,
} from '../exception/twilio-exception.filter.js';

import type { TwilioErrorResponse } from '../exception/twilio-exception.filter.js';
import type { ArgumentsHost } from '@nestjs/common';
import type { Mock } from 'vitest';

interface RecordingResponse {
  status: Mock;
  send: Mock;
}

/** A response double whose status() returns itself, mirroring the real chained `status(...).send(...)` call. */
function createResponse(): RecordingResponse {
  const response: RecordingResponse = {
    status: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

/** An ArgumentsHost double exposing only what the filter and BaseExceptionFilter need. */
function createHost(response: unknown, request: unknown = {}): ArgumentsHost {
  return {
    getArgs: () => [request, response],
    getArgByIndex: (index: number) => [request, response][index],
    switchToRpc: () => {
      throw new Error('RPC context not supported by this test double');
    },
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
    switchToWs: () => {
      throw new Error('WS context not supported by this test double');
    },
    getType: () => 'http',
  } as unknown as ArgumentsHost;
}

function sentBody(response: RecordingResponse): TwilioErrorResponse {
  return response.send.mock.calls[0]?.[0] as TwilioErrorResponse;
}

/**
 * Builds a value shaped like the Twilio SDK's RestException: a real Error
 * instance carrying the extra fields the SDK attaches. isTwilioRestException
 * checks this shape structurally rather than via instanceof, so tests build
 * the shape by hand instead of importing the SDK's class.
 */
function twilioError(overrides: Record<string, unknown> = {}): unknown {
  return Object.assign(new Error('The number is not a valid phone number.'), {
    status: 400,
    code: 21211,
    moreInfo: 'https://www.twilio.com/docs/errors/21211',
    ...overrides,
  });
}

describe('isTwilioRestException', () => {
  it('recognizes an Error carrying a numeric Twilio status code', () => {
    expect(isTwilioRestException(twilioError())).toBe(true);
  });

  it('rejects a generic Error with no status property', () => {
    expect(isTwilioRestException(new Error('boom'))).toBe(false);
  });

  it('rejects an Error whose status is not a number', () => {
    const error = Object.assign(new Error('boom'), { status: '400' });
    expect(isTwilioRestException(error)).toBe(false);
  });

  // The guard requires a real Error instance, not just matching field names.
  // This is what lets it stay correct even when the SDK's own RestException
  // class is not reliably identical across module instances: it trusts the
  // platform's Error, not a brand from a potentially-duplicated class.
  it('rejects a plain object shaped like a Twilio error but not an Error instance', () => {
    const fake = { status: 400, code: 21211, message: 'looks real' };
    expect(isTwilioRestException(fake)).toBe(false);
  });

  it('rejects null', () => {
    expect(isTwilioRestException(null)).toBe(false);
  });

  it('rejects a string', () => {
    expect(isTwilioRestException('not an error')).toBe(false);
  });
});

describe('TwilioExceptionFilter status mapping', () => {
  it('maps a 400-class Twilio status straight through to the HTTP response', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();

    filter.catch(twilioError({ status: 400, code: 21211 }), createHost(response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(sentBody(response).statusCode).toBe(400);
  });

  it('maps a 429 rate-limit Twilio status straight through', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();

    filter.catch(twilioError({ status: 429, code: 20429 }), createHost(response));

    expect(response.status).toHaveBeenCalledWith(429);
    expect(sentBody(response).statusCode).toBe(429);
  });
});

describe('TwilioExceptionFilter response body', () => {
  it('emits exactly the documented TwilioErrorResponse fields', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({
      status: 404,
      code: 20404,
      moreInfo: 'https://www.twilio.com/docs/errors/20404',
      details: { resourceUrl: '/2010-04-01/Accounts/AC.../Messages/SM...' },
    });

    filter.catch(error, createHost(response));

    expect(sentBody(response)).toEqual({
      statusCode: 404,
      message: 'The number is not a valid phone number.',
      code: '20404',
      moreInfo: 'https://www.twilio.com/docs/errors/20404',
      details: { resourceUrl: '/2010-04-01/Accounts/AC.../Messages/SM...' },
    });
  });

  it('falls back to "unknown" for the Twilio code when it is absent', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({ code: undefined });

    filter.catch(error, createHost(response));

    expect(sentBody(response).code).toBe('unknown');
  });

  it('falls back to "unknown" for the Twilio code when it is explicitly null', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({ code: null });

    filter.catch(error, createHost(response));

    expect(sentBody(response).code).toBe('unknown');
  });

  it('stringifies a numeric Twilio code rather than passing the number through', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({ code: 21211 });

    filter.catch(error, createHost(response));

    const body = sentBody(response);
    expect(body.code).toBe('21211');
    expect(typeof body.code).toBe('string');
  });

  it('omits moreInfo entirely when the Twilio error does not provide one', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({ moreInfo: undefined });

    filter.catch(error, createHost(response));

    expect(sentBody(response)).not.toHaveProperty('moreInfo');
  });

  it('omits details entirely when the Twilio error does not provide any', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({ details: undefined });

    filter.catch(error, createHost(response));

    expect(sentBody(response)).not.toHaveProperty('details');
  });

  it('falls back to a generic message when the Twilio error message is empty', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = Object.assign(new Error(''), { status: 500, code: 20500 });

    filter.catch(error, createHost(response));

    expect(sentBody(response).message).toBe('Twilio request failed');
  });
});

describe('TwilioExceptionFilter pass-through for non-Twilio exceptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Every Nest HttpException carries a numeric `.status`, which is the shape a
  // naive check looks for. v5.0.0 therefore claimed every BadRequestException
  // and NotFoundException as a Twilio error: registered globally, as this
  // filter's own examples show, it discarded the real response body and
  // replaced it with `{ code: 'unknown' }`. A class-validator message array
  // vanished from every 400. Do not delete this test.
  it('leaves a Nest HttpException to the base filter, preserving its real body', () => {
    const catchSpy = vi
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const exception = new BadRequestException(['name must not be empty']);

    filter.catch(exception, createHost(response));

    expect(catchSpy).toHaveBeenCalledWith(exception, expect.anything());
    // The filter must not reshape it, which is what destroyed the body before.
    expect(response.status).not.toHaveBeenCalled();
    expect(response.send).not.toHaveBeenCalled();
  });

  it('does not claim a third-party error that merely carries a numeric status', () => {
    // A numeric `status` alone is not evidence of Twilio. Requiring one of
    // code/moreInfo/details keeps unrelated SDK errors out of the Twilio shape.
    const exception = Object.assign(new Error('upstream refused'), { status: 503 });

    expect(isTwilioRestException(exception)).toBe(false);
  });

  it('delegates a plain Error without a Twilio-shaped status to the base filter', () => {
    const catchSpy = vi
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const host = createHost(response);
    const exception = new Error('unrelated failure');

    filter.catch(exception, host);

    expect(catchSpy).toHaveBeenCalledWith(exception, host);
    expect(response.status).not.toHaveBeenCalled();
  });
});

describe('TwilioExceptionFilter credential safety', () => {
  it('never copies auth tokens or API secrets from the Twilio error onto the response body', () => {
    const filter = new TwilioExceptionFilter();
    const response = createResponse();
    const error = twilioError({
      authToken: 'super-secret-auth-token',
      apiKeySecret: 'super-secret-api-key-secret',
      accountSid: 'ACaccountsidaccountsidaccountsid',
    });

    filter.catch(error, createHost(response));

    const body = sentBody(response);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('super-secret-auth-token');
    expect(serialized).not.toContain('super-secret-api-key-secret');
    expect(body).not.toHaveProperty('authToken');
    expect(body).not.toHaveProperty('apiKeySecret');
    expect(body).not.toHaveProperty('accountSid');
  });
});
