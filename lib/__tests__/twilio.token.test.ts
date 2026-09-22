import { BadRequestException, Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// Verify with the same JWT library the Twilio SDK signs with, so these
// assertions exercise real cryptography rather than our own round-trip.
import { verify } from 'jsonwebtoken';
import { jwt } from 'twilio';

import { TwilioModule } from '../module/twilio.module.js';
import { TwilioTokenService } from '../token/twilio-token.service.js';

import type { ModuleRef } from '@nestjs/core';
import type { TwilioClient } from '../utils/twilio.interface.js';

const ACCOUNT_SID = `AC${'x'.repeat(32)}`;
const API_KEY = `SK${'x'.repeat(32)}`;
const API_SECRET = 'the_api_key_secret';

interface TokenClaims {
  iss: string;
  sub: string;
  exp: number;
  iat: number;
  nbf?: number;
  grants: Record<string, unknown> & { identity?: string };
}

const decode = (token: string): TokenClaims =>
  JSON.parse(Buffer.from(token.split('.')[1] as string, 'base64').toString()) as TokenClaims;

/** A client stub carrying credentials in the shape createTwilioClient produces. */
const clientStub = (overrides: Partial<TwilioClient> = {}): TwilioClient =>
  ({
    username: API_KEY,
    password: API_SECRET,
    accountSid: ACCOUNT_SID,
    ...overrides,
  }) as TwilioClient;

/** A service backed by a ModuleRef that always resolves the given client. */
const serviceFor = (client: TwilioClient): TwilioTokenService =>
  new TwilioTokenService({ get: () => client } as unknown as ModuleRef);

describe('TwilioTokenService', () => {
  describe('token structure', () => {
    it('signs with the API key SID as issuer and the account as subject', () => {
      const claims = decode(serviceFor(clientStub()).createVideoToken({ identity: 'alice' }));

      expect(claims.iss).toBe(API_KEY);
      expect(claims.sub).toBe(ACCOUNT_SID);
    });

    // The signature is the whole point of the token; a structurally correct
    // but unsigned JWT would pass every other assertion here.
    it('produces a signature that verifies under the API key secret', () => {
      const token = serviceFor(clientStub()).createVideoToken({ identity: 'alice' });

      expect(() => verify(token, API_SECRET)).not.toThrow();
      expect(() => verify(token, 'a_different_secret')).toThrow();
    });

    it('carries the identity', () => {
      const claims = decode(serviceFor(clientStub()).createVideoToken({ identity: 'alice' }));

      expect(claims.grants.identity).toBe('alice');
    });

    it('defaults to the SDK one-hour lifetime', () => {
      const claims = decode(serviceFor(clientStub()).createVideoToken({ identity: 'alice' }));

      expect(claims.exp - claims.iat).toBe(3600);
    });

    it('honours an explicit ttl', () => {
      const claims = decode(
        serviceFor(clientStub()).createVideoToken({ identity: 'alice', ttl: 120 })
      );

      expect(claims.exp - claims.iat).toBe(120);
    });

    it('honours nbf', () => {
      const notBefore = Math.floor(Date.now() / 1000) + 60;
      const claims = decode(
        serviceFor(clientStub()).createVideoToken({ identity: 'alice', nbf: notBefore })
      );

      expect(claims.nbf).toBe(notBefore);
    });
  });

  describe('grants', () => {
    it('mints a Voice grant with incoming and outgoing settings', () => {
      const claims = decode(
        serviceFor(clientStub()).createVoiceToken({
          identity: 'alice',
          incomingAllow: true,
          outgoingApplicationSid: `AP${'x'.repeat(32)}`,
        })
      );

      expect(claims.grants.voice).toEqual({
        incoming: { allow: true },
        outgoing: { application_sid: `AP${'x'.repeat(32)}` },
      });
    });

    it('mints a Video grant scoped to a room', () => {
      const claims = decode(
        serviceFor(clientStub()).createVideoToken({ identity: 'alice', room: 'standup' })
      );

      expect(claims.grants.video).toEqual({ room: 'standup' });
    });

    it('mints a Chat grant', () => {
      const claims = decode(
        serviceFor(clientStub()).createChatToken({
          identity: 'alice',
          serviceSid: `IS${'x'.repeat(32)}`,
        })
      );

      expect(claims.grants.chat).toEqual({ service_sid: `IS${'x'.repeat(32)}` });
    });

    it('mints a Sync grant', () => {
      const claims = decode(
        serviceFor(clientStub()).createSyncToken({
          identity: 'alice',
          serviceSid: `IS${'x'.repeat(32)}`,
        })
      );

      expect(claims.grants.data_sync).toEqual({ service_sid: `IS${'x'.repeat(32)}` });
    });

    it('carries several grants on one token', () => {
      const claims = decode(
        serviceFor(clientStub()).createToken({
          identity: 'alice',
          grants: [
            new jwt.AccessToken.VideoGrant({ room: 'standup' }),
            new jwt.AccessToken.SyncGrant({ serviceSid: `IS${'x'.repeat(32)}` }),
          ],
        })
      );

      expect(claims.grants.video).toBeDefined();
      expect(claims.grants.data_sync).toBeDefined();
    });

    it('rejects a token carrying no grants, which could access nothing', () => {
      expect(() => serviceFor(clientStub()).createToken({ identity: 'alice', grants: [] })).toThrow(
        /at least one grant/
      );
    });
  });

  describe('validation', () => {
    it('requires an identity', () => {
      expect(() => serviceFor(clientStub()).createVideoToken({ identity: '' })).toThrow(
        BadRequestException
      );
    });

    // Twilio caps tokens at 24 hours and rejects longer ones at use time,
    // which is far from the line that set the ttl.
    it('rejects a ttl beyond Twilio 24 hour maximum', () => {
      expect(() =>
        serviceFor(clientStub()).createVideoToken({ identity: 'alice', ttl: 86_401 })
      ).toThrow(/24 hours/);
    });

    it('accepts a ttl at exactly the maximum', () => {
      expect(() =>
        serviceFor(clientStub()).createVideoToken({ identity: 'alice', ttl: 86_400 })
      ).not.toThrow();
    });

    it('rejects a non-positive or fractional ttl', () => {
      const service = serviceFor(clientStub());

      expect(() => service.createVideoToken({ identity: 'alice', ttl: 0 })).toThrow(/positive/);
      expect(() => service.createVideoToken({ identity: 'alice', ttl: -5 })).toThrow(/positive/);
      expect(() => service.createVideoToken({ identity: 'alice', ttl: 1.5 })).toThrow(/whole/);
    });

    // Voice fails on a bad identity at connection time, in the browser, with
    // no reference to the server line that minted the token.
    it('rejects Voice identities containing characters Voice cannot use', () => {
      const service = serviceFor(clientStub());

      expect(() => service.createVoiceToken({ identity: 'alice@example.com' })).toThrow(
        /letters, digits and underscores/
      );
      expect(() => service.createVoiceToken({ identity: 'alice smith' })).toThrow(
        /letters, digits and underscores/
      );
    });

    it('allows that same identity for products that permit it', () => {
      expect(() =>
        serviceFor(clientStub()).createVideoToken({ identity: 'alice@example.com' })
      ).not.toThrow();
    });
  });

  describe('credentials', () => {
    // Auth tokens cannot sign access tokens. Without this check the service
    // would emit a JWT that Twilio rejects, surfacing only on the client.
    it('refuses a client configured with an auth token', () => {
      const authTokenClient = clientStub({ username: ACCOUNT_SID, password: 'auth_token' });

      expect(() => serviceFor(authTokenClient).createVideoToken({ identity: 'alice' })).toThrow(
        /must be signed with an API key/
      );
    });

    it('names the client that is missing an API key', () => {
      const authTokenClient = clientStub({ username: ACCOUNT_SID, password: 'auth_token' });

      expect(() =>
        serviceFor(authTokenClient).createVideoToken({ identity: 'alice' }, 'billing')
      ).toThrow(/the client named 'billing'/);
    });

    it('reports an unregistered client rather than failing obscurely', () => {
      const service = new TwilioTokenService({
        get: () => {
          throw new Error('not found');
        },
      } as unknown as ModuleRef);

      expect(() => service.createVideoToken({ identity: 'alice' }, 'billing')).toThrow(
        /registerClient/
      );
    });

    it('never puts the signing secret in an error message', () => {
      const service = new TwilioTokenService({
        get: () => clientStub({ username: ACCOUNT_SID }),
      } as unknown as ModuleRef);

      let message: string | undefined;
      try {
        service.createVideoToken({ identity: 'alice' });
      } catch (thrown: unknown) {
        message = (thrown as Error).message;
      }

      expect(message).toBeDefined();
      expect(message).not.toContain(API_SECRET);
    });
  });
});

// The stubs above prove the token logic; this proves the service is actually
// wired into the module and resolves real registered clients.
describe('TwilioTokenService dependency injection', () => {
  @Controller()
  class TokenController {
    constructor(readonly tokens: TwilioTokenService) {}

    @Get()
    noop(): void {}
  }

  @Module({
    imports: [
      TwilioModule.forRoot({ accountSid: ACCOUNT_SID, apiKey: API_KEY, apiSecret: API_SECRET }),
      TwilioModule.registerClient({
        name: 'billing',
        accountSid: `AC${'y'.repeat(32)}`,
        apiKey: `SK${'y'.repeat(32)}`,
        apiSecret: 'billing_secret',
      }),
    ],
    controllers: [TokenController],
  })
  class AppModule {}

  it('is injectable and mints against the default client', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    const claims = decode(
      moduleRef.get(TokenController).tokens.createVideoToken({ identity: 'alice' })
    );

    expect(claims.iss).toBe(API_KEY);
    expect(claims.sub).toBe(ACCOUNT_SID);

    await moduleRef.close();
  });

  // Subaccounts carry their own API keys, so a token minted for a named client
  // must be signed by that client's credentials, not the root's.
  it('signs with a named client own credentials', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    const token = moduleRef
      .get(TokenController)
      .tokens.createVideoToken({ identity: 'alice' }, 'billing');
    const claims = decode(token);

    expect(claims.iss).toBe(`SK${'y'.repeat(32)}`);
    expect(claims.sub).toBe(`AC${'y'.repeat(32)}`);
    expect(() => verify(token, 'billing_secret')).not.toThrow();
    // The root credentials must not be able to verify a subaccount token.
    expect(() => verify(token, API_SECRET)).toThrow();

    await moduleRef.close();
  });
});
