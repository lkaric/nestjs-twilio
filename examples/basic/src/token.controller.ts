import { Controller, Get, Query } from '@nestjs/common';
import { TwilioTokenService } from 'nestjs-twilio';

/**
 * Mints Access Tokens for Twilio's client-side SDKs.
 *
 * A browser or mobile app calls these endpoints, receives a short-lived JWT,
 * and uses it to talk to Twilio directly. Your account credentials never
 * leave the server.
 *
 * Tokens are signed with an API key, so these routes mint against the
 * `realtime` client, which is registered with `apiKey` / `apiSecret`. Minting
 * against the default client here would fail loudly, because it authenticates
 * with an auth token.
 */
@Controller('token')
export class TokenController {
  constructor(private readonly tokens: TwilioTokenService) {}

  /** Voice token. Identity is restricted to letters, digits and underscores. */
  @Get('voice')
  voice(@Query('identity') identity: string): { token: string } {
    return {
      token: this.tokens.createVoiceToken(
        {
          identity,
          incomingAllow: true,
          // Ten minutes: long enough to place a call, short enough that a
          // leaked token is not worth much.
          ttl: 600,
        },
        'realtime'
      ),
    };
  }

  /** Video token, optionally scoped to a single room. */
  @Get('video')
  video(@Query('identity') identity: string, @Query('room') room?: string): { token: string } {
    return {
      token: this.tokens.createVideoToken({ identity, room, ttl: 600 }, 'realtime'),
    };
  }
}
