# Migration guide: v4 → v5

v5 is a breaking release. This guide lists every breaking change and the exact
edit required for each one.

If you are not ready to move, v4 keeps working: pin `nestjs-twilio@^4`.

## Breaking changes at a glance

| #   | Change                                               | Action required                            |
| --- | ---------------------------------------------------- | ------------------------------------------ |
| 1   | `twilio` moved to `peerDependencies`                 | Install `twilio` yourself                  |
| 2   | Nest peer range is now `^11 \|\| ^12`                | Upgrade Nest to 11 or 12                   |
| 3   | `reflect-metadata` and `rxjs` are now explicit peers | Ensure both are installed                  |
| 4   | Minimum Node.js is 20.19                             | Upgrade your runtime                       |
| 5   | Client options are flat, not nested under `options`  | Move `options: { … }` fields up one level  |
| 6   | Credentials are validated at bootstrap               | Ensure they are defined before `forRoot`   |
| 7   | The package now has an `exports` map                 | Replace deep imports with the package root |
| 8   | `isGlobal` removed; the module is always global      | Delete `isGlobal` from `forRoot()`         |

---

## 1. `twilio` is a peer dependency

In v4 `twilio` was a direct dependency, so every consumer received a second,
version-pinned copy of the SDK that they could not upgrade independently. In v5
you own that dependency.

```bash
npm install nestjs-twilio twilio
```

Supported range: `twilio@^5.0.0 || ^6.0.0`.

## 2. Nest peer range

v4 declared `@nestjs/common >=9.0.0`. v5 requires:

```
@nestjs/common  ^11.0.0 || ^12.0.0
@nestjs/core    ^11.0.0 || ^12.0.0
```

Verify with `npm ls @nestjs/common`. If you are on Nest 9 or 10, stay on
`nestjs-twilio@^4`.

## 3. Newly explicit peers

`reflect-metadata` (`^0.1.12 || ^0.2.0`) and `rxjs` (`^7.8.0`) are now declared
peers. They were already required transitively by Nest, so in most projects
this needs no change — but a strict package manager may now warn if either is
missing.

`@nestjs/terminus` (`^11 || ^12`) is an **optional** peer, required only if you
use the health indicator.

## 4. Node.js 20.19+

`engines.node` is now `>=20.19.0`.

```bash
node -v        # must be >= 20.19.0
echo "22.12.0" > .node-version
```

## 5. Client options are flat

This is the one change that touches application code.

v4 nested the Twilio SDK client options under an `options` key:

```ts
// v4
TwilioModule.forRoot({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  options: {
    region: 'ie1',
    edge: 'sydney',
    logLevel: 'debug',
  },
});
```

v5 flattens them: `TwilioModuleOptions` extends the SDK's `ClientOpts`
directly, so every client option is a top-level key.

```ts
// v5
TwilioModule.forRoot({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  region: 'ie1',
  edge: 'sydney',
  logLevel: 'debug',
});
```

The same applies inside `forRootAsync`'s factory return value.

## 6. Credentials are validated at bootstrap

v4 typed `accountSid` and `authToken` as `string | undefined` and passed them
straight through, so a missing environment variable surfaced later as an opaque
`TypeError` from inside the Twilio SDK.

v5 validates on module initialisation and throws a `BadRequestException`
naming the offending field. Credentials are never included in the message.

If you relied on constructing the module without credentials, supply them or
register the module conditionally.

## 7. `exports` map

v5 ships dual ESM and CJS builds behind an `exports` map. Deep imports into the
package's internals no longer resolve:

```diff
- import { TwilioService } from 'nestjs-twilio/dist/module/twilio.service';
+ import { TwilioService } from 'nestjs-twilio';
```

Everything public is exported from the package root.

---

## 8. `isGlobal` is gone — the module is always global

v4 accepted an `isGlobal` flag, defaulting to `false`. v5 removes it and always
registers globally, matching `TypeOrmCoreModule`, Mongoose's core module and
`BullModule.forRoot()`.

```diff
  TwilioModule.forRoot({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
-   isGlobal: true,
  })
```

Leaving `isGlobal` in place is a type error, so the compiler finds every
occurrence for you.

Beyond convention, this is what lets named clients registered with
`registerClient()` inherit the options from `forRoot()`: each named client is
its own module, and a non-global root would be invisible to it.

---

## 9. API key authentication now works

v4 and early v5 builds accepted `apiKey` but never passed `apiSecret` to the
SDK, and sent the account SID where Twilio expects the key SID. A client
configured that way authenticated against nothing and failed every request.

If you configured `apiKey` without `apiSecret`, the module now rejects it at
startup rather than producing a broken client:

```diff
  TwilioModule.forRoot({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKey: process.env.TWILIO_API_KEY,
+   apiSecret: process.env.TWILIO_API_SECRET,
  })
```

Auth-token configuration is unaffected.

---

## What did _not_ change

- `TwilioModule.forRoot()` and `TwilioModule.forRootAsync()` keep their names
  and call shapes.
- `TwilioService` and its `client` getter are unchanged.

---

## Step-by-step

```bash
# 1. Upgrade the runtime
echo "22.12.0" > .node-version

# 2. Install v5 alongside an explicit twilio
npm install nestjs-twilio@^5 twilio@^6

# 3. Upgrade Nest if needed
npm install @nestjs/common@^11 @nestjs/core@^11

# 4. Flatten any `options: { … }` in your forRoot / forRootAsync config

# 5. Type-check your app; the flattening change surfaces as a type error
npx tsc --noEmit
```

---

## New in v5 (opt-in, nothing to migrate)

These are additive. Adopt them when convenient.

**Webhook signature validation**

```ts
import { TwilioWebhook } from 'nestjs-twilio';

@Post('/webhooks/sms')
@TwilioWebhook()
handleSms(@Body() body: TwilioWebhookRequest) {
  // Request signature has already been verified.
}
```

**TwiML responses**

```ts
import { TwimlInterceptor } from 'nestjs-twilio';
import { MessagingResponse } from 'twilio/lib/twiml/MessagingResponse';

@Post('/sms/reply')
@UseInterceptors(TwimlInterceptor)
reply() {
  const twiml = new MessagingResponse();
  twiml.message('Hello!');
  return twiml; // serialised to XML with the correct Content-Type
}
```

**Twilio errors as HTTP responses**

```ts
import { TwilioExceptionFilter } from 'nestjs-twilio';

@UseFilters(TwilioExceptionFilter)
export class SmsController {}
```

**Injecting the raw client**

```ts
import { InjectTwilio } from 'nestjs-twilio';
import type { Twilio } from 'twilio';

constructor(@InjectTwilio() private readonly twilio: Twilio) {}
```

---

## Rolling back

```bash
npm install nestjs-twilio@^4
```

v4 remains on npm and is unaffected by this release.

---

## Getting help

- Issues: <https://github.com/lkaric/nestjs-twilio/issues>
- Discussions: <https://github.com/lkaric/nestjs-twilio/discussions>
