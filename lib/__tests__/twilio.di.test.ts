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

  // registerClient() used to be forFeature() and returned `module: TwilioModule`.
  // Nest treats two dynamic modules naming the same class as one, so the named
  // client's providers replaced forRoot's and TwilioService lost its options
  // token.
  it('keeps forRoot working alongside registerClient', async () => {
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
        TwilioModule.registerClient({ name: 'billing', ...billingConfig }),
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

  // The defect that reading the Nest docs surfaced: transport settings on
  // forRoot() were silently dropped for every named client, so subaccount
  // traffic left through a different Twilio edge than was configured.
  it('inherits transport settings from forRoot', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio('billing') readonly billing: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot({ ...rootConfig, region: 'ie1', edge: 'dublin' }),
        TwilioModule.registerClient({ name: 'billing', ...billingConfig }),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const { billing } = moduleRef.get(Consumer, { strict: false });

    expect(billing.region).toBe('ie1');
    expect(billing.edge).toBe('dublin');
    // Credentials are still the client's own.
    expect(billing.accountSid).toBe(billingConfig.accountSid);
    await moduleRef.close();
  });

  // Reading config from the environment yields `undefined` for unset variables.
  // A plain spread would let that clear an inherited value; only defined values
  // may override.
  it('treats an explicit undefined as inherit, not as clear', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio('billing') readonly billing: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot({ ...rootConfig, region: 'ie1' }),
        TwilioModule.registerClient({
          name: 'billing',
          ...billingConfig,
          region: undefined, // as an unset process.env value would be
        }),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(Consumer, { strict: false }).billing.region).toBe('ie1');
    await moduleRef.close();
  });

  it('lets a defined value override an inherited one', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio('au') readonly au: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot({ ...rootConfig, region: 'ie1' }),
        TwilioModule.registerClient({ name: 'au', ...billingConfig, region: 'au1' }),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(Consumer, { strict: false }).au.region).toBe('au1');
    await moduleRef.close();
  });

  it('registers a named client with no forRoot at all', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio('solo') readonly solo: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [TwilioModule.registerClient({ name: 'solo', ...billingConfig })],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(Consumer, { strict: false }).solo.accountSid).toBe(
      billingConfig.accountSid
    );
    await moduleRef.close();
  });

  it('builds a real client from registerClientAsync, not the raw options object', async () => {
    @Controller()
    class Consumer {
      constructor(@InjectTwilio('async') readonly client: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot({ ...rootConfig, region: 'ie1' }),
        TwilioModule.registerClientAsync({ name: 'async', useFactory: () => billingConfig }),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const { client } = moduleRef.get(Consumer, { strict: false });

    expect(client.accountSid).toBe(billingConfig.accountSid);
    // The async path must inherit too.
    expect(client.region).toBe('ie1');
    // A raw options object has no `messages` resource; a real client exposes
    // one with a `create` method.
    expect(typeof client.messages.create).toBe('function');
    await moduleRef.close();
  });

  it('supports useClass in registerClientAsync', async () => {
    class BillingConfig {
      createTwilioClientOptions() {
        return billingConfig;
      }
    }

    @Controller()
    class Consumer {
      constructor(@InjectTwilio('viaclass') readonly client: TwilioClient) {}

      @Get()
      noop(): void {}
    }

    @Module({
      imports: [
        TwilioModule.forRoot(rootConfig),
        TwilioModule.registerClientAsync({ name: 'viaclass', useClass: BillingConfig }),
      ],
      controllers: [Consumer],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(Consumer, { strict: false }).client.accountSid).toBe(
      billingConfig.accountSid
    );
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
