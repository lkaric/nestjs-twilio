---
title: Access Tokens
description: Mint short-lived Access Tokens so browser and mobile clients can use Twilio's Voice, Video, Conversations and Sync SDKs.
---

Twilio's client-side SDKs — [Voice](https://www.twilio.com/docs/voice/sdks),
[Video](https://www.twilio.com/docs/video),
[Conversations](https://www.twilio.com/docs/conversations) and
[Sync](https://www.twilio.com/docs/sync) — authenticate with **Access Tokens**:
short-lived JWTs your server mints so a browser or phone can talk to Twilio
directly, without ever holding your account credentials.

`TwilioTokenService` mints them.

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { TwilioTokenService } from 'nestjs-twilio';

@Controller('token')
export class TokenController {
  constructor(private readonly tokens: TwilioTokenService) {}

  @Get('voice')
  voice(@Query('identity') identity: string) {
    return {
      token: this.tokens.createVoiceToken({ identity, incomingAllow: true }),
    };
  }
}
```

## Credentials

Access Tokens are signed with an **API key**, never an auth token. The client
you mint from must be registered with `apiKey` and `apiSecret`:

```ts
TwilioModule.forRoot({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  apiKey: process.env.TWILIO_API_KEY, // SK…
  apiSecret: process.env.TWILIO_API_SECRET,
});
```

Minting from a client configured with an `authToken` throws a
`BadRequestException` naming the client, rather than emitting a JWT that Twilio
would reject once it reached the browser.

:::caution[Restricted keys cannot mint tokens]
**Main** and **Standard** API keys work. **Restricted** keys authenticate REST
requests but [cannot create Access
Tokens](https://www.twilio.com/docs/iam/api-keys/restricted-api-keys).

All three types share the `SK` prefix, so this can only surface as an error
from Twilio at token-creation time — it is not detectable locally.
:::

## Per-product helpers

| Method               | Grant              | Key options                                                            |
| -------------------- | ------------------ | ---------------------------------------------------------------------- |
| `createVoiceToken()` | Programmable Voice | `incomingAllow`, `outgoingApplicationSid`, `outgoingApplicationParams` |
| `createVideoToken()` | Programmable Video | `room`                                                                 |
| `createChatToken()`  | Conversations      | `serviceSid`, `pushCredentialSid`                                      |
| `createSyncToken()`  | Sync               | `serviceSid`                                                           |

Every helper accepts the shared JWT settings — `identity`, `ttl`, `nbf` and
`region` — alongside its grant-specific options.

```ts
this.tokens.createVideoToken({ identity: 'alice', room: 'daily-standup' });
this.tokens.createChatToken({ identity: 'alice', serviceSid: 'ISxxxxxxxx' });
this.tokens.createSyncToken({ identity: 'alice', serviceSid: 'ISxxxxxxxx' });
```

## TaskRouter, Playback and multi-grant tokens

`createToken()` accepts grants you build yourself. Use it for products without
a dedicated helper, or to put several grants on one token:

```ts
import { jwt } from 'twilio';

this.tokens.createToken({
  identity: 'alice',
  grants: [
    new jwt.AccessToken.VideoGrant({ room: 'daily-standup' }),
    new jwt.AccessToken.ChatGrant({ serviceSid: 'ISxxxxxxxx' }),
  ],
});
```

A token with no grants is rejected — it could not access anything.

## Named clients

Pass a client name as the second argument to sign with a
[named client's](/features/multi-account/) own credentials. Subaccounts carry
their own API keys, so a subaccount token must be signed by that subaccount:

```ts
this.tokens.createVoiceToken({ identity: 'alice' }, 'billing');
```

Omit the name to use the default client.

## Lifetime

Tokens default to **one hour**. Twilio caps them at **24 hours** and recommends
the shortest lifetime your application can tolerate, since a leaked token is
valid until it expires.

```ts
this.tokens.createVideoToken({ identity: 'alice', ttl: 600 }); // 10 minutes
```

A `ttl` above 86400 is rejected at mint time. Twilio would otherwise reject the
token when the client tried to use it, far from the code that set it.

## Identities

The `identity` is how Twilio and your application identify the user, and it is
what other participants see.

:::note[Voice restricts the character set]
Voice identities may contain only letters, digits and underscores. An address
like `alice@example.com` is valid for Video, Chat and Sync, but Voice rejects it
at **connection** time, in the browser.

`createVoiceToken()` therefore validates the identity when minting, so the
error arrives at the server line responsible for it.
:::

## Reference

| Option     | Type     | Description                                           |
| ---------- | -------- | ----------------------------------------------------- |
| `identity` | `string` | Required. Who the token represents.                   |
| `ttl`      | `number` | Lifetime in seconds. Default `3600`, maximum `86400`. |
| `nbf`      | `number` | Epoch seconds before which the token is not accepted. |
| `region`   | `string` | Twilio Region. Honoured for Voice tokens.             |

See the [Access Tokens reference](https://www.twilio.com/docs/iam/access-tokens)
for the full token model.
