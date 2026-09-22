import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { twiml } from 'twilio';

import {
  DEFAULT_TWIML_CONTENT_TYPE,
  isTwimlResponse,
  TWIML_RESPONSE_TYPE_METADATA,
  TwimlInterceptor,
  TwimlResponseType,
} from '../twiml/twiml.interceptor.js';

import type { CallHandler, ExecutionContext } from '@nestjs/common';

// A route-shaped class carrying real @TwimlResponseType metadata, exactly the
// way a controller method would. Reading metadata off a genuinely decorated
// function (rather than injecting it by hand) also proves the decorator
// itself writes under TWIML_RESPONSE_TYPE_METADATA.
class TwimlTestController {
  @TwimlResponseType('application/vnd.acme.twiml+xml')
  overridden(): void {
    return undefined;
  }

  // Called with no argument: SetMetadata still records `undefined` rather
  // than leaving the key unset, so the interceptor's `?? this.contentType`
  // fallback is what makes this route usable at all.
  @TwimlResponseType()
  overriddenWithNoValue(): void {
    return undefined;
  }

  plain(): void {
    return undefined;
  }
}

/** A CallHandler double whose handle() emits the given controller return value once. */
function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) } as unknown as CallHandler;
}

/** An HTTP ExecutionContext double; header() calls are observable via the returned spy. */
function httpContext(handler: () => void = TwimlTestController.prototype.plain) {
  const header = vi.fn();
  const context = {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => TwimlTestController,
    switchToHttp: () => ({ getResponse: () => ({ header }) }),
  } as unknown as ExecutionContext;
  return { context, header };
}

/** A non-HTTP transport context, e.g. an RPC handler wrapped by the same global interceptor. */
function rpcContext() {
  const header = vi.fn();
  const context = {
    getType: () => 'rpc',
    getHandler: () => TwimlTestController.prototype.plain,
    getClass: () => TwimlTestController,
    switchToHttp: () => ({ getResponse: () => ({ header }) }),
  } as unknown as ExecutionContext;
  return { context, header };
}

function run(interceptor: TwimlInterceptor, context: ExecutionContext, value: unknown) {
  return firstValueFrom(interceptor.intercept(context, handlerReturning(value)));
}

describe('isTwimlResponse', () => {
  it('recognizes each of the three concrete TwiML builders', () => {
    expect(isTwimlResponse(new twiml.VoiceResponse())).toBe(true);
    expect(isTwimlResponse(new twiml.MessagingResponse())).toBe(true);
    expect(isTwimlResponse(new twiml.FaxResponse())).toBe(true);
  });

  it('rejects plain values that only look like a TwiML response', () => {
    expect(isTwimlResponse({ toString: () => '<Response/>' })).toBe(false);
    expect(isTwimlResponse('<Response/>')).toBe(false);
    expect(isTwimlResponse(null)).toBe(false);
    expect(isTwimlResponse(undefined)).toBe(false);
  });
});

describe('TwimlInterceptor', () => {
  describe('serialization', () => {
    it('replaces a returned MessagingResponse with its own toString() XML', async () => {
      const response = new twiml.MessagingResponse();
      response.message('Thanks for texting us!');
      const interceptor = new TwimlInterceptor();
      const { context } = httpContext();

      const result = await run(interceptor, context, response);

      expect(result).toBe(response.toString());
      expect(result).toContain('<Message>Thanks for texting us!</Message>');
    });
  });

  describe('content type precedence', () => {
    it('falls back to DEFAULT_TWIML_CONTENT_TYPE when nothing overrides it', async () => {
      const interceptor = new TwimlInterceptor();
      const { context, header } = httpContext();

      await run(interceptor, context, new twiml.VoiceResponse());

      expect(header).toHaveBeenCalledWith('Content-Type', DEFAULT_TWIML_CONTENT_TYPE);
      expect(header).toHaveBeenCalledTimes(1);
    });

    it('lets the constructor option override the built-in default', async () => {
      const interceptor = new TwimlInterceptor({ contentType: 'application/xml' });
      const { context, header } = httpContext();

      await run(interceptor, context, new twiml.VoiceResponse());

      expect(header).toHaveBeenCalledWith('Content-Type', 'application/xml');
    });

    it('lets a per-route @TwimlResponseType override beat the constructor option', async () => {
      const interceptor = new TwimlInterceptor({ contentType: 'application/xml' });
      const { context, header } = httpContext(TwimlTestController.prototype.overridden);

      await run(interceptor, context, new twiml.VoiceResponse());

      expect(header).toHaveBeenCalledWith('Content-Type', 'application/vnd.acme.twiml+xml');
    });

    it('falls through to the constructor option when the route decorator carries no value', async () => {
      const interceptor = new TwimlInterceptor({ contentType: 'application/xml' });
      const { context, header } = httpContext(TwimlTestController.prototype.overriddenWithNoValue);

      await run(interceptor, context, new twiml.VoiceResponse());

      expect(header).toHaveBeenCalledWith('Content-Type', 'application/xml');
    });
  });

  describe('non-TwiML pass-through', () => {
    it.each([
      ['a plain object', { ok: true }],
      ['a string', 'just some text'],
      ['null', null],
      ['undefined', undefined],
    ])('leaves %s untouched and never forces a Content-Type', async (_label, value) => {
      const interceptor = new TwimlInterceptor();
      const { context, header } = httpContext();

      const result = await run(interceptor, context, value);

      expect(result).toBe(value);
      expect(header).not.toHaveBeenCalled();
    });
  });

  describe('transport guard', () => {
    it('leaves a TwiML response untouched on a non-HTTP transport', async () => {
      const interceptor = new TwimlInterceptor();
      const response = new twiml.VoiceResponse();
      const { context, header } = rpcContext();

      const result = await run(interceptor, context, response);

      expect(result).toBe(response);
      expect(header).not.toHaveBeenCalled();
    });
  });

  describe('TwimlResponseType metadata', () => {
    it('stores the content type under TWIML_RESPONSE_TYPE_METADATA, readable via Reflector', () => {
      const reflector = new Reflector();

      const contentType = reflector.get<string | undefined, string>(
        TWIML_RESPONSE_TYPE_METADATA,
        TwimlTestController.prototype.overridden
      );

      expect(contentType).toBe('application/vnd.acme.twiml+xml');
    });

    it('stores undefined, not an absent key, when called with no argument', () => {
      const reflector = new Reflector();

      const contentType = reflector.get<string | undefined, string>(
        TWIML_RESPONSE_TYPE_METADATA,
        TwimlTestController.prototype.overriddenWithNoValue
      );

      expect(contentType).toBeUndefined();
    });
  });
});
