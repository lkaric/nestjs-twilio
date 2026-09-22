import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';

import { TwilioModule } from '../module/twilio.module.js';
import { TwilioHealthIndicator } from '../terminus/twilio.health.js';
import { getTwilioClientToken } from '../utils/twilio.utils.js';

import type { TwilioClient } from '../utils/twilio.interface.js';

const rootConfig = {
  accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  authToken: 'root_token',
};

/** A client whose account fetch resolves with the given status. */
function clientReturning(status: string, sid = rootConfig.accountSid): TwilioClient {
  return {
    accountSid: sid,
    api: {
      v2010: {
        accounts: () => ({
          fetch: async () => ({ sid, status, friendlyName: 'Test Account' }),
        }),
      },
    },
  } as unknown as TwilioClient;
}

/** A client whose account fetch rejects, as it would when Twilio is unreachable. */
function clientFailing(message: string): TwilioClient {
  return {
    accountSid: rootConfig.accountSid,
    api: {
      v2010: {
        accounts: () => ({
          fetch: async () => {
            throw new Error(message);
          },
        }),
      },
    },
  } as unknown as TwilioClient;
}

async function buildIndicator(client?: TwilioClient) {
  @Module({
    imports: [TerminusModule, TwilioModule.forRoot(rootConfig)],
    providers: [TwilioHealthIndicator],
  })
  class HealthTestModule {}

  const builder = Test.createTestingModule({ imports: [HealthTestModule] });

  if (client) {
    builder.overrideProvider(getTwilioClientToken()).useValue(client);
  }

  const moduleRef = await builder.compile();
  return { moduleRef, indicator: moduleRef.get(TwilioHealthIndicator, { strict: false }) };
}

describe('TwilioHealthIndicator', () => {
  it('reports up when the account fetch succeeds and the account is active', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientReturning('active'));

    const result = await indicator.isHealthy('twilio');

    expect(result.twilio.status).toBe('up');
    expect(result.twilio).toMatchObject({ accountSid: rootConfig.accountSid });
    await moduleRef.close();
  });

  // A suspended account authenticates but cannot send anything, so it is not
  // healthy even though the request succeeded.
  it('reports down when the account is suspended', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientReturning('suspended'));

    const result = await indicator.isHealthy('twilio');

    expect(result.twilio.status).toBe('down');
    expect(String(result.twilio.message)).toContain('suspended');
    await moduleRef.close();
  });

  it('reports down when the account is closed', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientReturning('closed'));

    expect((await indicator.isHealthy('twilio')).twilio.status).toBe('down');
    await moduleRef.close();
  });

  // Built on attempt() rather than up()/down() precisely so a thrown request
  // becomes a `down` result instead of aborting the health check with a 500.
  it('reports down rather than throwing when the request fails', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientFailing('ECONNREFUSED'));

    const result = await indicator.isHealthy('twilio');

    expect(result.twilio.status).toBe('down');
    expect(String(result.twilio.message)).toContain('ECONNREFUSED');
    await moduleRef.close();
  });

  it('uses the key it is given', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientReturning('active'));

    const result = await indicator.isHealthy('twilio-billing');

    expect(result).toHaveProperty('twilio-billing');
    await moduleRef.close();
  });

  it('probes an explicitly supplied client instead of the default', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientReturning('active'));
    const billing = clientReturning('active', 'ACyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy');

    const result = await indicator.isHealthy('billing', billing);

    expect(result.billing).toMatchObject({ accountSid: 'ACyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy' });
    await moduleRef.close();
  });

  it('returns a builder so withTimeout can be chained', async () => {
    const { moduleRef, indicator } = await buildIndicator(clientReturning('active'));

    const result = await indicator.isHealthy('twilio').withTimeout(5000);

    expect(result.twilio.status).toBe('up');
    await moduleRef.close();
  });

  it('reports down, with guidance, when no client is registered at all', async () => {
    @Module({ imports: [TerminusModule], providers: [TwilioHealthIndicator] })
    class BareModule {}

    const moduleRef = await Test.createTestingModule({ imports: [BareModule] }).compile();
    const indicator = moduleRef.get(TwilioHealthIndicator, { strict: false });

    const result = await indicator.isHealthy('twilio');

    expect(result.twilio.status).toBe('down');
    expect(String(result.twilio.message)).toContain('TwilioModule.forRoot()');
    await moduleRef.close();
  });
});
