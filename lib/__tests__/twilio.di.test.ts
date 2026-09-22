import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { TwilioModule } from '../module/twilio.module.js';
import { TwilioService } from '../module/twilio.service.js';
import { InjectTwilio } from '../module/twilio.decorator.js';
import { getTwilioClientToken } from '../utils/twilio.utils.js';
import { TwilioWebhook } from '../webhook/twilio-webhook.decorator.js';
import { TwilioWebhookGuard } from '../webhook/twilio-webhook.guard.js';
import { TWILIO_WEBHOOK_OPTIONS } from '../webhook/twilio-webhook.options.js';

import type { TwilioClient } from '../utils/twilio.interface.js';

const rootConfig = {
  accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  authToken: 'root_token',
};

const billingConfig = {
  accountSid: 'ACyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  authToken: 'billing_token',
};

describe('getTwilioClientToken', () => {
  // A plain Symbol() mints a distinct value per call, which silently breaks
  // every injection: the provider registers one token and the consumer asks
  // for another. This must stay an identity assertion.
  it('returns the identical symbol for repeated calls', () => {
    expect(getTwilioClientToken()).toBe(getTwilioClientToken());
    expect(getTwilioClientToken('billing')).toBe(getTwilioClientToken('billing'));
  });

  it('distinguishes the default client from named clients', () => {
    expect(getTwilioClientToken()).not.toBe(getTwilioClientToken('billing'));
    expect(getTwilioClientToken('a')).not.toBe(getTwilioClientToken('b'));
  });

  it('matches names case-insensitively', () => {
    expect(getTwilioClientToken('Billing')).toBe(getTwilioClientToken('billing'));
  });
});

describe('dependency injection', () => {
  it('resolves the raw client through @InjectTwilio()', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio() readonly client: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({ imports: [TwilioModule.forRoot(rootConfig)], controllers: [Consumer] })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const consumer = moduleRef.get(Consumer, { strict: false });

    expect(consumer.client.accountSid).toBe(rootConfig.accountSid);
    await moduleRef.close();
  });

  it('gives @InjectTwilio() and TwilioService the same client instance', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio() readonly client: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({ imports: [TwilioModule.forRoot(rootConfig)], controllers: [Consumer] })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(Consumer, { strict: false }).client).toBe(
      moduleRef.get(TwilioService, { strict: false }).client
    );
    await moduleRef.close();
  });

  // forFeature() used to return `module: TwilioModule`. Nest treats two
  // dynamic modules naming the same class as one, so the feature's providers
  // replaced forRoot's and TwilioService lost its options token.
  it('keeps forRoot working alongside forFeature', async () => {
    @Controller()
    class Consumer {
      constructor(
        @InjectTwilio() readonly root: TwilioClient,
        @InjectTwilio('billing') readonly billing: TwilioClient
      ) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot(rootConfig),
        TwilioModule.forFeature('billing', billingConfig),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const consumer = moduleRef.get(Consumer, { strict: false });

    expect(consumer.root.accountSid).toBe(rootConfig.accountSid);
    expect(consumer.billing.accountSid).toBe(billingConfig.accountSid);
    await moduleRef.close();
  });

  it('builds a real client from forFeatureAsync, not the raw options object', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio('async') readonly client: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot(rootConfig),
        TwilioModule.forFeatureAsync('async', { useFactory: () => billingConfig }),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const { client } = moduleRef.get(Consumer, { strict: false });

    expect(client.accountSid).toBe(billingConfig.accountSid);
    // A raw options object has no `messages` resource; a real client exposes
    // one with a `create` method.
    expect(typeof client.messages.create).toBe('function');
    await moduleRef.close();
  });

  it('exposes module webhook settings to the guard', async () => {
    @Module({
      imports: [
        TwilioModule.forRoot({
          ...rootConfig,
          webhookAuthToken: 'webhook_token',
          webhookUrl: 'https://example.com',
        }),
      ],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(TWILIO_WEBHOOK_OPTIONS, { strict: false })).toEqual({
      authToken: 'webhook_token',
      url: 'https://example.com',
    });
    await moduleRef.close();
  });

  it('falls back to the client auth token when no webhook token is set', async () => {
    @Module({ imports: [TwilioModule.forRoot(rootConfig)] })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(TWILIO_WEBHOOK_OPTIONS, { strict: false })).toMatchObject({
      authToken: rootConfig.authToken,
    });
    await moduleRef.close();
  });
});

describe('@TwilioWebhook()', () => {
  // The decorator previously only called SetMetadata, so routes it decorated
  // were never actually guarded — requests with no signature passed straight
  // through.
  it('binds TwilioWebhookGuard to the decorated handler', () => {
    class Controllerish {
      @TwilioWebhook()
      handler(): void {}
    }

    const guards: unknown[] = Reflect.getMetadata('__guards__', Controllerish.prototype.handler);

    expect(guards).toContain(TwilioWebhookGuard);
  });

  it('records the options the guard reads', () => {
    class Controllerish {
      @TwilioWebhook({ authToken: 'per_route' })
      handler(): void {}
    }

    expect(Reflect.getMetadata(TWILIO_WEBHOOK_OPTIONS, Controllerish.prototype.handler)).toEqual({
      authToken: 'per_route',
    });
  });
});
