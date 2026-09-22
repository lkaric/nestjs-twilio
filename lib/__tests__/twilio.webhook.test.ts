import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import twilio from 'twilio';

import { TwilioWebhook } from '../webhook/twilio-webhook.decorator.js';
import { TwilioWebhookGuard } from '../webhook/twilio-webhook.guard.js';
import { TWILIO_WEBHOOK_OPTIONS } from '../webhook/twilio-webhook.options.js';

import type { TwilioWebhookRequest } from '../webhook/twilio-webhook.guard.js';
import type { TwilioWebhookOptions } from '../webhook/twilio-webhook.options.js';
import type { ExecutionContext } from '@nestjs/common';

const AUTH_TOKEN = 'test_auth_token';
const WEBHOOK_URL = 'https://example.com/webhooks/sms';

// Same SDK function the guard calls internally, so every fixture below
// produces a signature Twilio itself would have produced, never a
// hand-written string.
const sign = twilio.getExpectedTwilioSignature;

const reflector = new Reflector();

/**
 * An HTTP ExecutionContext double carrying real `@TwilioWebhook()` metadata.
 * Reading the metadata off a genuinely decorated method (rather than
 * injecting it by hand) also proves the decorator writes options under the
 * key this guard actually reads.
 */
function makeContext(params: {
  handler: () => void;
  klass: new (...args: unknown[]) => unknown;
  request: TwilioWebhookRequest;
}): ExecutionContext {
  return {
    getHandler: () => params.handler,
    getClass: () => params.klass,
    switchToHttp: () => ({ getRequest: () => params.request }),
  } as unknown as ExecutionContext;
}

/** Attaches a per-request options override the way upstream middleware would. */
function withRequestOptions(
  request: TwilioWebhookRequest,
  options: TwilioWebhookOptions
): TwilioWebhookRequest {
  (request as unknown as Record<typeof TWILIO_WEBHOOK_OPTIONS, TwilioWebhookOptions>)[
    TWILIO_WEBHOOK_OPTIONS
  ] = options;
  return request;
}

describe('TwilioWebhookGuard', () => {
  describe('form-encoded signature validation', () => {
    it('accepts a request signed with the configured auth token and URL', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        handler(): void {}
      }

      const body = { From: '+15551234567', Body: 'Hello' };
      const signature = sign(AUTH_TOKEN, WEBHOOK_URL, body);
      const guard = new TwilioWebhookGuard(reflector);

      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: { headers: { 'x-twilio-signature': signature }, body },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    // This exact case shipped broken once: @TwilioWebhook() only called
    // SetMetadata and never actually attached the guard, so a request with
    // no signature at all still reached the handler and returned 201. This
    // test must never be deleted: it is the one assertion that would have
    // caught that regression at the guard level, independent of the wiring
    // test in twilio.di.test.ts.
    it('rejects a request with no X-Twilio-Signature header', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        handler(): void {}
      }

      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: { headers: {}, body: { From: '+15551234567' } },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects a forged signature', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        handler(): void {}
      }

      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          headers: { 'x-twilio-signature': 'not-a-real-signature' },
          body: { From: '+15551234567' },
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects a signature that was computed for different parameters', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        handler(): void {}
      }

      // Signed for one payload, sent with another: a real "mismatched"
      // signature rather than an arbitrary forged string.
      const signature = sign(AUTH_TOKEN, WEBHOOK_URL, { From: '+15551234567', Body: 'Hello' });
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          headers: { 'x-twilio-signature': signature },
          body: { From: '+15551234567', Body: 'Goodbye' },
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('treats a missing or non-object body as empty params rather than crashing', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        handler(): void {}
      }

      // A signature-only webhook (e.g. a status callback with no form
      // fields) can reach the guard with `body` left undefined by the body
      // parser. It must be validated against an empty parameter set, not
      // thrown into `Object.keys()` and crash.
      const signature = sign(AUTH_TOKEN, WEBHOOK_URL, {});
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: { headers: { 'x-twilio-signature': signature }, body: undefined },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('auth token resolution', () => {
    it('rejects loudly, rather than silently passing, when no auth token is configured anywhere', () => {
      class Controllerish {
        @TwilioWebhook({ url: WEBHOOK_URL })
        handler(): void {}
      }

      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: { headers: { 'x-twilio-signature': 'anything' }, body: {} },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(/no auth token is configured/i);
    });
  });

  describe('URL reconstruction', () => {
    it('uses options.url verbatim, ignoring the request protocol/host/path', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        handler(): void {}
      }

      const body = { Body: 'hi' };
      const signature = sign(AUTH_TOKEN, WEBHOOK_URL, body);
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'http',
          originalUrl: '/totally/different/path',
          headers: { host: 'internal-host:3000', 'x-twilio-signature': signature },
          body,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('honors X-Forwarded-Proto/X-Forwarded-Host behind a reverse proxy', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const publicUrl = 'https://public.example.com/webhooks/sms';
      const body = { Body: 'hi' };
      const signature = sign(AUTH_TOKEN, publicUrl, body);
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          // What Nest actually saw: TLS terminated and rewritten at the proxy.
          protocol: 'http',
          originalUrl: '/webhooks/sms',
          headers: {
            host: 'internal-app:3000',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'public.example.com',
            'x-twilio-signature': signature,
          },
          body,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('takes the first entry from a comma-joined X-Forwarded-* header on a multi-hop proxy chain', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const publicUrl = 'https://public.example.com/webhooks/sms';
      const body = { Body: 'hi' };
      const signature = sign(AUTH_TOKEN, publicUrl, body);
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'http',
          originalUrl: '/webhooks/sms',
          headers: {
            host: 'internal-app:3000',
            'x-forwarded-proto': 'https, http',
            'x-forwarded-host': 'public.example.com, edge-proxy.internal',
            'x-twilio-signature': signature,
          },
          body,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('lets options.protocol/options.host override forwarded headers', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, protocol: 'https', host: 'canonical.example.com' })
        handler(): void {}
      }

      const canonicalUrl = 'https://canonical.example.com/webhooks/sms';
      const body = { Body: 'hi' };
      const signature = sign(AUTH_TOKEN, canonicalUrl, body);
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'http',
          originalUrl: '/webhooks/sms',
          headers: {
            host: 'wrong-host:3000',
            'x-forwarded-proto': 'http',
            'x-forwarded-host': 'wrong.example.com',
            'x-twilio-signature': signature,
          },
          body,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('falls back to request.url when originalUrl is absent, as on the Fastify adapter', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const url = 'https://example.com/webhooks/sms';
      const body = { Body: 'hi' };
      const signature = sign(AUTH_TOKEN, url, body);
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'https',
          url: '/webhooks/sms',
          headers: { host: 'example.com', 'x-twilio-signature': signature },
          body,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('defaults to https when no protocol is available from options, forwarded headers, or the request', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN, host: 'example.com' })
        handler(): void {}
      }

      const url = 'https://example.com/webhooks/sms';
      const body = { Body: 'hi' };
      const signature = sign(AUTH_TOKEN, url, body);
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          // No `protocol` field at all: some minimal request shapes omit it.
          originalUrl: '/webhooks/sms',
          headers: { 'x-twilio-signature': signature },
          body,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('JSON webhooks (bodySHA256)', () => {
    it('takes the validateRequestWithBody path when the resolved URL carries a bodySHA256 parameter', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const rawBody = JSON.stringify({ EventType: 'call.completed', CallSid: 'CA123' });
      const bodyHash = createHash('sha256').update(rawBody, 'utf-8').digest('hex');
      const url = `https://example.com/webhooks/voice-status?bodySHA256=${bodyHash}`;
      const signature = sign(AUTH_TOKEN, url, {});
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'https',
          originalUrl: `/webhooks/voice-status?bodySHA256=${bodyHash}`,
          headers: { host: 'example.com', 'x-twilio-signature': signature },
          rawBody,
          body: JSON.parse(rawBody) as unknown,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('reads the raw body from a Buffer, as populated by rawBody: true on some adapters', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const rawBody = JSON.stringify({ EventType: 'call.completed' });
      const bodyHash = createHash('sha256').update(rawBody, 'utf-8').digest('hex');
      const url = `https://example.com/webhooks/voice-status?bodySHA256=${bodyHash}`;
      const signature = sign(AUTH_TOKEN, url, {});
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'https',
          originalUrl: `/webhooks/voice-status?bodySHA256=${bodyHash}`,
          headers: { host: 'example.com', 'x-twilio-signature': signature },
          rawBody: Buffer.from(rawBody, 'utf-8'),
          body: JSON.parse(rawBody) as unknown,
        },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('rejects a JSON body tampered with after signing, even though the header-level signature still matches', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const signedBody = JSON.stringify({ EventType: 'call.completed' });
      const bodyHash = createHash('sha256').update(signedBody, 'utf-8').digest('hex');
      const url = `https://example.com/webhooks/voice-status?bodySHA256=${bodyHash}`;
      // The signature only ever covers the URL (including bodySHA256), so a
      // header computed this way is valid on its own. It is validateBody(),
      // inside validateRequestWithBody, that must independently reject the
      // swapped payload below - proving the guard really calls the
      // body-aware validator and not just validateRequest.
      const signature = sign(AUTH_TOKEN, url, {});
      const tamperedBody = JSON.stringify({ EventType: 'call.completed', Extra: 'injected' });
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'https',
          originalUrl: `/webhooks/voice-status?bodySHA256=${bodyHash}`,
          headers: { host: 'example.com', 'x-twilio-signature': signature },
          rawBody: tamperedBody,
          body: JSON.parse(tamperedBody) as unknown,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    // Documented in resolveRawBody(): with no captured rawBody the guard
    // re-serializes request.body, which only reproduces the exact bytes
    // Twilio sent when JSON.stringify happens to walk the keys in the same
    // order. Same values, different insertion order, is a real failure mode.
    it('rejects when re-serializing an unordered body does not byte-match, with rawBody unset', () => {
      class Controllerish {
        @TwilioWebhook({ authToken: AUTH_TOKEN })
        handler(): void {}
      }

      const rawBody = JSON.stringify({ EventType: 'call.completed', CallSid: 'CA123' });
      const bodyHash = createHash('sha256').update(rawBody, 'utf-8').digest('hex');
      const url = `https://example.com/webhooks/voice-status?bodySHA256=${bodyHash}`;
      const signature = sign(AUTH_TOKEN, url, {});
      // Same values as `rawBody`, reversed key order: JSON.stringify will
      // not reproduce Twilio's original bytes.
      const reorderedBody = { CallSid: 'CA123', EventType: 'call.completed' };
      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: {
          protocol: 'https',
          originalUrl: `/webhooks/voice-status?bodySHA256=${bodyHash}`,
          headers: { host: 'example.com', 'x-twilio-signature': signature },
          body: reorderedBody,
        },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('disableValidation', () => {
    it('bypasses validation entirely for the decorated route', () => {
      class Controllerish {
        @TwilioWebhook({ disableValidation: true })
        handler(): void {}
      }

      const guard = new TwilioWebhookGuard(reflector);
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        // No signature and no auth token anywhere: this would fail every
        // other check in the guard if disableValidation did not short-circuit.
        request: { headers: {}, body: {} },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('is per-route: a sibling handler without disableValidation still validates', () => {
      class Controllerish {
        @TwilioWebhook({ disableValidation: true })
        open(): void {}

        @TwilioWebhook({ authToken: AUTH_TOKEN, url: WEBHOOK_URL })
        guarded(): void {}
      }

      const guard = new TwilioWebhookGuard(reflector);

      const openContext = makeContext({
        handler: Controllerish.prototype.open,
        klass: Controllerish,
        request: { headers: {}, body: {} },
      });
      expect(guard.canActivate(openContext)).toBe(true);

      const guardedContext = makeContext({
        handler: Controllerish.prototype.guarded,
        klass: Controllerish,
        request: { headers: {}, body: {} },
      });
      expect(() => guard.canActivate(guardedContext)).toThrow(ForbiddenException);
    });
  });

  describe('option precedence', () => {
    it('falls back to the module-level default when no decorator or request override is set', () => {
      class Controllerish {
        @TwilioWebhook()
        handler(): void {}
      }

      const defaultOptions: TwilioWebhookOptions = { authToken: AUTH_TOKEN, url: WEBHOOK_URL };
      const guard = new TwilioWebhookGuard(reflector, defaultOptions);
      const signature = sign(AUTH_TOKEN, WEBHOOK_URL, {});
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request: { headers: { 'x-twilio-signature': signature }, body: {} },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('lets a per-request override beat the module-level default', () => {
      class Controllerish {
        @TwilioWebhook()
        handler(): void {}
      }

      const requestToken = 'request_level_token';
      const defaultOptions: TwilioWebhookOptions = { authToken: AUTH_TOKEN, url: WEBHOOK_URL };
      const guard = new TwilioWebhookGuard(reflector, defaultOptions);
      const signature = sign(requestToken, WEBHOOK_URL, {});
      const request = withRequestOptions(
        { headers: { 'x-twilio-signature': signature }, body: {} },
        {
          authToken: requestToken,
          url: WEBHOOK_URL,
        }
      );
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request,
      });

      expect(guard.canActivate(context)).toBe(true);
      // The module default token alone would not have produced this
      // signature, which is what proves the override actually took effect.
      expect(sign(AUTH_TOKEN, WEBHOOK_URL, {})).not.toBe(signature);
    });

    it('lets decorator options beat both the request override and the module default', () => {
      const decoratorToken = 'decorator_level_token';

      class Controllerish {
        @TwilioWebhook({ authToken: decoratorToken, url: WEBHOOK_URL })
        handler(): void {}
      }

      const requestToken = 'request_level_token';
      const defaultOptions: TwilioWebhookOptions = { authToken: AUTH_TOKEN, url: WEBHOOK_URL };
      const guard = new TwilioWebhookGuard(reflector, defaultOptions);
      const signature = sign(decoratorToken, WEBHOOK_URL, {});
      const request = withRequestOptions(
        { headers: { 'x-twilio-signature': signature }, body: {} },
        {
          authToken: requestToken,
          url: WEBHOOK_URL,
        }
      );
      const context = makeContext({
        handler: Controllerish.prototype.handler,
        klass: Controllerish,
        request,
      });

      expect(guard.canActivate(context)).toBe(true);
      // Signing with the request-level token instead must not validate,
      // confirming the decorator genuinely wins rather than both happening
      // to accept.
      const requestSignedInstead = sign(requestToken, WEBHOOK_URL, {});
      expect(requestSignedInstead).not.toBe(signature);
    });
  });
});
