import type twilio from 'twilio';
import type { TwilioClient } from '../utils/twilio.interface.js';

/** The `AccessToken` namespace from the Twilio SDK. */
type AccessTokenNamespace = typeof twilio.jwt.AccessToken;

/**
 * Any grant the SDK can attach to an access token.
 *
 * Derived from the SDK's own classes rather than restated, so a grant added
 * upstream is a compile error here rather than a silent omission.
 */
export type TwilioGrant = InstanceType<
  | AccessTokenNamespace['VoiceGrant']
  | AccessTokenNamespace['VideoGrant']
  | AccessTokenNamespace['ChatGrant']
  | AccessTokenNamespace['SyncGrant']
  | AccessTokenNamespace['TaskRouterGrant']
  | AccessTokenNamespace['PlaybackGrant']
>;

/**
 * JWT settings shared by every token, independent of which grants it carries.
 *
 * @see https://www.twilio.com/docs/iam/access-tokens#step-3-generate-token
 */
export interface TwilioTokenOptions {
  /**
   * Identity the token represents, normally a username in your system.
   *
   * Voice tokens accept only alphanumeric characters and underscores; this is
   * enforced when minting a Voice token.
   */
  identity: string;

  /**
   * Lifetime in seconds. Defaults to the SDK's 3600. Twilio caps tokens at
   * 24 hours (86400), and recommends the shortest lifetime your application
   * can tolerate.
   */
  ttl?: number;

  /** Epoch seconds before which the token is not accepted. */
  nbf?: number;

  /**
   * Twilio Region for the token. Currently honoured for Voice tokens only.
   *
   * @see https://www.twilio.com/docs/global-infrastructure/understanding-twilio-regions
   */
  region?: string;
}

/**
 * Options for a Voice token.
 *
 * @see https://www.twilio.com/docs/voice/sdks
 */
export interface TwilioVoiceTokenOptions extends TwilioTokenOptions {
  /** Allow this identity to receive incoming calls. */
  incomingAllow?: boolean;
  /** TwiML Application SID that handles outgoing calls. Starts with `AP`. */
  outgoingApplicationSid?: string;
  /** Extra parameters passed to the TwiML Application on outgoing calls. */
  outgoingApplicationParams?: object;
  /** Push credential used to deliver incoming-call notifications. */
  pushCredentialSid?: string;
  /** Identifies this specific device or browser tab. */
  endpointId?: string;
}

/**
 * Options for a Video token.
 *
 * @see https://www.twilio.com/docs/video
 */
export interface TwilioVideoTokenOptions extends TwilioTokenOptions {
  /** Room this token grants access to. Omit to allow any room. */
  room?: string;
}

/**
 * Options for a Conversations (Chat) token.
 *
 * @see https://www.twilio.com/docs/conversations
 */
export interface TwilioChatTokenOptions extends TwilioTokenOptions {
  /** Conversation Service SID. Starts with `IS`. */
  serviceSid?: string;
  /** Identifies this specific device or browser tab. */
  endpointId?: string;
  /** Role assigned on deployment. */
  deploymentRoleSid?: string;
  /** Push credential used to deliver notifications. */
  pushCredentialSid?: string;
}

/**
 * Options for a Sync token.
 *
 * @see https://www.twilio.com/docs/sync
 */
export interface TwilioSyncTokenOptions extends TwilioTokenOptions {
  /** Sync Service SID. Starts with `IS`. */
  serviceSid?: string;
  /** Identifies this specific device or browser tab. */
  endpointId?: string;
}

/**
 * Options for a token carrying grants you construct yourself: TaskRouter,
 * Playback, or several grants at once.
 */
export interface TwilioCustomTokenOptions extends TwilioTokenOptions {
  /** Grants to attach. At least one is required for a usable token. */
  grants: TwilioGrant[];
}

/**
 * The credentials an access token is signed with, extracted from a client.
 *
 * @internal
 */
export interface TwilioTokenCredentials {
  accountSid: string;
  apiKey: string;
  apiSecret: string;
}

/** A client the token service can mint tokens for. */
export type TwilioTokenClient = TwilioClient;
