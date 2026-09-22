import { BadRequestException } from '@nestjs/common';

import {
  createTwilioClient,
  mergeClientOptions,
  validateTwilioOptions,
} from '../utils/twilio.utils.js';

type Options = Parameters<typeof createTwilioClient>[0];

const ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const API_KEY = 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const options = (extra: Record<string, unknown>) =>
  ({ accountSid: ACCOUNT_SID, ...extra }) as unknown as Options;

// The Twilio SDK constructor is `new Twilio(username, password, opts)`. Which
// value goes where depends on the auth mode, and getting it wrong produces a
// client that authenticates against nothing — every request fails, with no
// local signal. These assertions pin the mapping.
describe('client authentication', () => {
  describe('auth token', () => {
    it('sends the account SID as username and the auth token as password', () => {
      const client = createTwilioClient(options({ authToken: 'my_auth_token' }));

      expect(client.username).toBe(ACCOUNT_SID);
      expect(client.password).toBe('my_auth_token');
      expect(client.accountSid).toBe(ACCOUNT_SID);
    });
  });

  describe('API key', () => {
    it('sends the key SID as username and the secret as password', () => {
      const client = createTwilioClient(
        options({ apiKey: API_KEY, apiSecret: 'super_secret_value' })
      );

      expect(client.username).toBe(API_KEY);
      expect(client.password).toBe('super_secret_value');
    });

    // The account SID cannot be inferred from an SK-prefixed username, so it
    // has to travel via ClientOpts. Without it the SDK throws on construction.
    it('still resolves the account SID, which the key SID cannot supply', () => {
      const client = createTwilioClient(
        options({ apiKey: API_KEY, apiSecret: 'super_secret_value' })
      );

      expect(client.accountSid).toBe(ACCOUNT_SID);
    });

    it('does not leak the secret into ClientOpts', () => {
      const client = createTwilioClient(
        options({ apiKey: API_KEY, apiSecret: 'super_secret_value', region: 'ie1' })
      );

      expect(client.region).toBe('ie1');
      // apiSecret is a constructor argument; it must not survive as an option.
      expect((client as unknown as Record<string, unknown>).apiSecret).toBeUndefined();
    });
  });

  it('prefers the auth token when both credential types are supplied', () => {
    const client = createTwilioClient(
      options({ authToken: 'my_auth_token', apiKey: API_KEY, apiSecret: 'secret' })
    );

    expect(client.username).toBe(ACCOUNT_SID);
    expect(client.password).toBe('my_auth_token');
  });

  it('keeps module-level webhook settings out of the SDK options', () => {
    const client = createTwilioClient(
      options({ authToken: 't', webhookAuthToken: 'wt', webhookUrl: 'https://example.test' })
    );

    const asRecord = client as unknown as Record<string, unknown>;
    expect(asRecord.webhookAuthToken).toBeUndefined();
    expect(asRecord.webhookUrl).toBeUndefined();
  });
});

describe('credential validation', () => {
  it('rejects an apiKey supplied without an apiSecret', () => {
    // Treating the secret as optional is precisely what allowed it to be
    // dropped silently.
    expect(() => validateTwilioOptions(options({ apiKey: API_KEY }))).toThrow(BadRequestException);
    expect(() => validateTwilioOptions(options({ apiKey: API_KEY }))).toThrow(/apiSecret/);
  });

  it('rejects an apiKey that is not an SK SID', () => {
    expect(() =>
      validateTwilioOptions(options({ apiKey: 'ACnot_a_key', apiSecret: 'secret' }))
    ).toThrow(/should start with "SK"/);
  });

  it('rejects a missing accountSid', () => {
    expect(() => validateTwilioOptions({ authToken: 't' } as unknown as Options)).toThrow(
      /accountSid is required/
    );
  });

  it('rejects an accountSid that is not an AC SID', () => {
    expect(() =>
      validateTwilioOptions({ accountSid: 'SKwrong', authToken: 't' } as unknown as Options)
    ).toThrow(/should start with "AC"/);
  });

  it('rejects options carrying no credentials at all', () => {
    expect(() => validateTwilioOptions(options({}))).toThrow(/authToken/);
  });

  it('accepts either complete credential set', () => {
    expect(() => validateTwilioOptions(options({ authToken: 't' }))).not.toThrow();
    expect(() => validateTwilioOptions(options({ apiKey: API_KEY, apiSecret: 's' }))).not.toThrow();
  });

  it('never echoes a secret in its error messages', () => {
    const secret = 'super_secret_value';
    let message: string | undefined;

    try {
      validateTwilioOptions({ accountSid: '', apiKey: API_KEY, apiSecret: secret } as Options);
    } catch (thrown: unknown) {
      message = (thrown as Error).message;
    }

    expect(message).toBeDefined();
    expect(message).not.toContain(secret);
  });
});

// `authToken` and `apiKey`/`apiSecret` are alternative authentication modes,
// not independent settings. Merging them field-by-field lets an inherited
// value outrank an explicitly configured one — which made it impossible to
// register an API-key client beneath an auth-token root. The example app
// caught this; these assertions keep it caught.
describe('credential inheritance', () => {
  const root = { accountSid: ACCOUNT_SID, authToken: 'root_token', region: 'ie1' };

  it('drops an inherited authToken when the client supplies an API key', () => {
    const merged = mergeClientOptions(root, {
      name: 'realtime',
      apiKey: API_KEY,
      apiSecret: 'secret',
    });

    expect(merged.apiKey).toBe(API_KEY);
    expect(merged).not.toHaveProperty('authToken');
  });

  it('drops inherited API key credentials when the client supplies an auth token', () => {
    const keyRoot = { accountSid: ACCOUNT_SID, apiKey: API_KEY, apiSecret: 'secret' };

    const merged = mergeClientOptions(keyRoot, { name: 'billing', authToken: 'own_token' });

    expect(merged.authToken).toBe('own_token');
    expect(merged).not.toHaveProperty('apiKey');
    expect(merged).not.toHaveProperty('apiSecret');
  });

  // The credential rule must not widen into transport settings, which are
  // independent and must keep inheriting.
  it('still inherits transport settings across an auth mode change', () => {
    const merged = mergeClientOptions(root, {
      name: 'realtime',
      apiKey: API_KEY,
      apiSecret: 'secret',
    });

    expect(merged.region).toBe('ie1');
    expect(merged.accountSid).toBe(ACCOUNT_SID);
  });

  it('inherits credentials when the client supplies none of its own', () => {
    const merged = mergeClientOptions(root, { name: 'same-account' });

    expect(merged.authToken).toBe('root_token');
  });

  // A key present but undefined means "unset in the environment", which
  // inherits. It must not be mistaken for an auth mode the client chose.
  it('treats an undefined credential as absent, not as a mode selection', () => {
    const merged = mergeClientOptions(root, { name: 'billing', apiKey: undefined });

    expect(merged.authToken).toBe('root_token');
  });

  it('builds a working key-authed client beneath an auth-token root', () => {
    const client = createTwilioClient(
      mergeClientOptions(root, {
        name: 'realtime',
        apiKey: API_KEY,
        apiSecret: 'the_secret',
      }) as Options
    );

    expect(client.username).toBe(API_KEY);
    expect(client.password).toBe('the_secret');
  });
});
