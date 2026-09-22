import { BadRequestException, Injectable } from '@nestjs/common';
import twilio from 'twilio';

import { ModuleRef } from '@nestjs/core';

import { getTwilioClientToken } from '../utils/twilio.utils.js';

import type {
  TwilioChatTokenOptions,
  TwilioCustomTokenOptions,
  TwilioGrant,
  TwilioSyncTokenOptions,
  TwilioTokenCredentials,
  TwilioTokenOptions,
  TwilioVideoTokenOptions,
  TwilioVoiceTokenOptions,
} from './twilio-token.interface.js';
import type { TwilioClient } from '../utils/twilio.interface.js';

const { AccessToken } = twilio.jwt;

/** Twilio rejects tokens that live longer than 24 hours. */
const MAX_TTL_SECONDS = 86_400;

/**
 * Voice identities are restricted to these characters.
 *
 * @see https://www.twilio.com/docs/voice/sdks/javascript/best-practices#identity
 */
const VOICE_IDENTITY_PATTERN = /^[A-Za-z0-9_]+$/;

/**
 * Mints Access Tokens for Twilio's client-side SDKs: Voice, Video,
 * Conversations, Sync, TaskRouter and Playback.
 *
 * Access Tokens are short-lived credentials your server issues so a browser or
 * mobile client can talk to Twilio directly, without ever holding your account
 * credentials.
 *
 * Tokens are signed with an **API key**, never an auth token, so the client the
 * token is minted for must have been registered with `apiKey` and `apiSecret`.
 *
 * @see https://www.twilio.com/docs/iam/access-tokens
 *
 * @example Minting a Voice token
 * ```ts
 * @Controller('token')
 * export class TokenController {
 *   constructor(private readonly tokens: TwilioTokenService) {}
 *
 *   @Get('voice')
 *   voice(@Query('identity') identity: string) {
 *     return {
 *       token: this.tokens.createVoiceToken({
 *         identity,
 *         outgoingApplicationSid: 'APxxxxxxxx',
 *         incomingAllow: true,
 *       }),
 *     };
 *   }
 * }
 * ```
 */
@Injectable()
export class TwilioTokenService {
  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Mint a token granting access to Programmable Voice.
   *
   * @param options - Grant and JWT settings.
   * @param clientName - Named client to sign with. Omit for the default client.
   *
   * @throws BadRequestException When the identity contains characters Voice
   * rejects, the TTL exceeds 24 hours, or the client has no API key.
   *
   * @example
   * ```ts
   * tokens.createVoiceToken({ identity: 'alice', incomingAllow: true });
   * ```
   */
  public createVoiceToken(options: TwilioVoiceTokenOptions, clientName?: string): string {
    // Voice is the only product that constrains the identity character set,
    // and it fails at connection time rather than at token creation, which is
    // a long way from the mistake.
    if (!VOICE_IDENTITY_PATTERN.test(options.identity ?? '')) {
      throw new BadRequestException(
        'TwilioTokenService: a Voice identity may contain only letters, digits and underscores'
      );
    }

    const { incomingAllow, outgoingApplicationSid, outgoingApplicationParams, pushCredentialSid } =
      options;

    return this.createToken(
      {
        ...options,
        grants: [
          new AccessToken.VoiceGrant({
            incomingAllow,
            outgoingApplicationSid,
            outgoingApplicationParams,
            pushCredentialSid,
            endpointId: options.endpointId,
          }),
        ],
      },
      clientName
    );
  }

  /**
   * Mint a token granting access to Programmable Video.
   *
   * @param options - Grant and JWT settings. Omit `room` to allow any room.
   * @param clientName - Named client to sign with. Omit for the default client.
   *
   * @example
   * ```ts
   * tokens.createVideoToken({ identity: 'alice', room: 'daily-standup' });
   * ```
   */
  public createVideoToken(options: TwilioVideoTokenOptions, clientName?: string): string {
    return this.createToken(
      { ...options, grants: [new AccessToken.VideoGrant({ room: options.room })] },
      clientName
    );
  }

  /**
   * Mint a token granting access to Conversations.
   *
   * @param options - Grant and JWT settings.
   * @param clientName - Named client to sign with. Omit for the default client.
   *
   * @example
   * ```ts
   * tokens.createChatToken({ identity: 'alice', serviceSid: 'ISxxxxxxxx' });
   * ```
   */
  public createChatToken(options: TwilioChatTokenOptions, clientName?: string): string {
    const { serviceSid, endpointId, deploymentRoleSid, pushCredentialSid } = options;

    return this.createToken(
      {
        ...options,
        grants: [
          new AccessToken.ChatGrant({
            serviceSid,
            endpointId,
            deploymentRoleSid,
            pushCredentialSid,
          }),
        ],
      },
      clientName
    );
  }

  /**
   * Mint a token granting access to Sync.
   *
   * @param options - Grant and JWT settings.
   * @param clientName - Named client to sign with. Omit for the default client.
   *
   * @example
   * ```ts
   * tokens.createSyncToken({ identity: 'alice', serviceSid: 'ISxxxxxxxx' });
   * ```
   */
  public createSyncToken(options: TwilioSyncTokenOptions, clientName?: string): string {
    const { serviceSid, endpointId } = options;

    return this.createToken(
      { ...options, grants: [new AccessToken.SyncGrant({ serviceSid, endpointId })] },
      clientName
    );
  }

  /**
   * Mint a token carrying grants you construct yourself.
   *
   * Use this for TaskRouter and Playback, which have no dedicated helper, or to
   * put several grants on one token.
   *
   * @param options - Grants and JWT settings.
   * @param clientName - Named client to sign with. Omit for the default client.
   *
   * @throws BadRequestException When no grants are supplied, the identity is
   * missing, the TTL exceeds 24 hours, or the client has no API key.
   *
   * @example A token carrying both Video and Chat
   * ```ts
   * import { jwt } from 'twilio';
   *
   * tokens.createToken({
   *   identity: 'alice',
   *   grants: [
   *     new jwt.AccessToken.VideoGrant({ room: 'daily-standup' }),
   *     new jwt.AccessToken.ChatGrant({ serviceSid: 'ISxxxxxxxx' }),
   *   ],
   * });
   * ```
   */
  public createToken(options: TwilioCustomTokenOptions, clientName?: string): string {
    this.validateTokenOptions(options);

    if (options.grants.length === 0) {
      throw new BadRequestException(
        'TwilioTokenService: at least one grant is required; a token with no grants cannot access anything'
      );
    }

    const { accountSid, apiKey, apiSecret } = this.resolveCredentials(clientName);

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: options.identity,
      ttl: options.ttl,
      nbf: options.nbf,
      region: options.region,
    });

    for (const grant of options.grants as TwilioGrant[]) {
      token.addGrant(grant);
    }

    return token.toJwt();
  }

  /**
   * Validate the settings every token shares.
   *
   * @throws BadRequestException When the identity is absent or the TTL is out
   * of range.
   */
  private validateTokenOptions(options: TwilioTokenOptions): void {
    if (!options.identity || typeof options.identity !== 'string') {
      throw new BadRequestException(
        'TwilioTokenService: identity is required and must be a string'
      );
    }

    if (options.ttl === undefined) return;

    if (!Number.isInteger(options.ttl) || options.ttl <= 0) {
      throw new BadRequestException(
        'TwilioTokenService: ttl must be a positive whole number of seconds'
      );
    }

    // Twilio rejects the token at use time, not at creation, so catching it
    // here keeps the error next to the mistake.
    if (options.ttl > MAX_TTL_SECONDS) {
      throw new BadRequestException(
        `TwilioTokenService: ttl may not exceed ${MAX_TTL_SECONDS} seconds (24 hours)`
      );
    }
  }

  /**
   * Extract signing credentials from a registered client.
   *
   * A client built from an auth token cannot sign access tokens (Twilio
   * requires an API key), so this reports that rather than emitting a token
   * that would be rejected.
   *
   * @throws BadRequestException When the client is unknown or was not
   * configured with an API key.
   */
  private resolveCredentials(clientName?: string): TwilioTokenCredentials {
    const client = this.resolveClient(clientName);

    // After createTwilioClient, a key-authed client carries the key SID as its
    // username and the secret as its password.
    const apiKey = client.username;
    const apiSecret = client.password;

    if (!apiKey?.startsWith('SK') || !apiSecret) {
      throw new BadRequestException(
        `TwilioTokenService: ${describeClient(clientName)} was configured with an auth token, ` +
          'but access tokens must be signed with an API key. Register it with apiKey and apiSecret.'
      );
    }

    return { accountSid: client.accountSid, apiKey, apiSecret };
  }

  /**
   * Look up a registered client by name.
   *
   * @throws BadRequestException When no client is registered under that name.
   */
  private resolveClient(clientName?: string): TwilioClient {
    const token = getTwilioClientToken(clientName);

    try {
      // Named clients live in their own module, so the lookup has to search
      // the whole application rather than the current module only.
      return this.moduleRef.get<TwilioClient>(token, { strict: false });
    } catch {
      throw new BadRequestException(
        `TwilioTokenService: ${describeClient(clientName)} is not registered. ` +
          (clientName
            ? `Add TwilioModule.registerClient({ name: '${clientName}', … }).`
            : 'Call TwilioModule.forRoot() in your root module.')
      );
    }
  }
}

/** Name a client for an error message, without inventing a name for the default. */
function describeClient(clientName?: string): string {
  return clientName ? `the client named '${clientName}'` : 'the default client';
}
