/**
 * Typed shapes for the bodies Twilio posts to your webhooks.
 *
 * Twilio sends webhooks as `application/x-www-form-urlencoded`, so **every
 * value arrives as a string**: `NumMedia` is `'2'`, not `2`. These interfaces
 * model that faithfully rather than pretending otherwise; convert where you
 * need a number.
 *
 * Twilio also states that it "will occasionally add new parameters without
 * advance notice", so treat these as the documented subset rather than an
 * exhaustive list. Signature validation covers the whole body regardless of
 * which parameters it contains, so a new parameter never breaks verification.
 *
 * A few fields carry `@deprecated`. Those markers mirror Twilio's own
 * documentation: `SmsSid`, `SmsMessageSid` and `SmsStatus` are described
 * upstream as "deprecated and included for backward compatibility". They are
 * not ours to retire: Twilio still sends them on every request, so omitting
 * them would leave real fields untypeable. Prefer the documented replacement
 * named on each one.
 *
 * @see https://www.twilio.com/docs/messaging/guides/webhook-request
 * @see https://www.twilio.com/docs/voice/twiml#request-parameters
 */

/**
 * Lifecycle status of a Message resource.
 *
 * `receiving` and `received` apply to inbound messages; the rest describe an
 * outbound message moving from creation through delivery. `read` is only
 * reported by channels that support read receipts, currently RCS and WhatsApp.
 *
 * @see https://www.twilio.com/docs/messaging/api/message-resource#message-status-values
 */
export type TwilioMessageStatus =
  | 'accepted'
  | 'scheduled'
  | 'canceled'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'undelivered'
  | 'receiving'
  | 'received'
  | 'read';

/**
 * Status of a Call resource. Also the value of `DialCallStatus` on a
 * `<Dial>` action callback.
 *
 * @see https://www.twilio.com/docs/voice/twiml#callstatus-values
 */
export type TwilioCallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

/**
 * How a call originated: inbound, via the REST API, or from a `<Dial>` verb.
 */
export type TwilioCallDirection = 'inbound' | 'outbound-api' | 'outbound-dial';

/**
 * Geographic data Twilio derives from the `From` and `To` numbers.
 *
 * Every field is optional: Twilio includes them only when the lookup succeeds.
 */
export interface TwilioGeoParams {
  readonly FromCity?: string;
  readonly FromState?: string;
  readonly FromZip?: string;
  readonly FromCountry?: string;
  readonly ToCity?: string;
  readonly ToState?: string;
  readonly ToZip?: string;
  readonly ToCountry?: string;
}

/**
 * Media attached to an inbound message.
 *
 * Twilio numbers the keys from zero (`MediaUrl0`, `MediaContentType0`,
 * `MediaUrl1`, and so on) and `NumMedia` says how many there are. Because it
 * arrives as a string, parse it before looping.
 *
 * @example
 * ```ts
 * const count = Number(payload.NumMedia ?? 0);
 *
 * for (let index = 0; index < count; index += 1) {
 *   const url = payload[`MediaUrl${index}`];
 *   const contentType = payload[`MediaContentType${index}`];
 * }
 * ```
 */
export interface TwilioMediaParams {
  /** How many media items are attached. A string, e.g. `'2'`. */
  readonly NumMedia?: string;
  readonly [mediaUrl: `MediaUrl${number}`]: string | undefined;
  readonly [mediaContentType: `MediaContentType${number}`]: string | undefined;
}

/**
 * Parameters present only on WhatsApp messages.
 *
 * @see https://www.twilio.com/docs/whatsapp
 */
export interface TwilioWhatsAppParams {
  /** The sender's WhatsApp profile name, e.g. `'Perspective Coffee'`. */
  readonly ProfileName?: string;
  /** The sender's WhatsApp ID, typically a phone number without the `+`. */
  readonly WaId?: string;
  /** `'true'` when the message has been forwarded once. */
  readonly Forwarded?: string;
  /** `'true'` when the message has been forwarded many times. */
  readonly FrequentlyForwarded?: string;
  /** Sender of the message this one replies to, within the last 7 days. */
  readonly OriginalRepliedMessageSender?: string;
  /** SID of the message this one replies to, within the last 7 days. */
  readonly OriginalRepliedMessageSid?: string;
}

/**
 * Parameters Twilio adds for rich messaging: buttons, flows and
 * channel-specific payloads.
 *
 * `InteractiveData`, `FlowData` and `ChannelMetadata` arrive as **stringified
 * JSON**; parse them before use.
 */
export interface TwilioRichMessageParams {
  /** Postback payload identifying which button was pressed. */
  readonly ButtonPayload?: string;
  /** Visible label of the pressed button, e.g. `'Cancel Appointment'`. */
  readonly ButtonText?: string;
  /** Button category: `'REPLY'` or `'ACTION'`. */
  readonly ButtonType?: string;
  /** Stringified JSON holding an omnichannel rich-feature response. */
  readonly InteractiveData?: string;
  /** Stringified JSON payload returned after a WhatsApp flow completes. */
  readonly FlowData?: string;
  /** Stringified JSON: the full response from the rich-messaging channel. */
  readonly ChannelMetadata?: string;
}

/**
 * Parameters present when the sender shares a location.
 */
export interface TwilioLocationParams {
  readonly Latitude?: string;
  readonly Longitude?: string;
  readonly Address?: string;
  readonly Label?: string;
}

/**
 * Body of Twilio's request when a message arrives at one of your numbers.
 *
 * @example
 * ```ts
 * @Post('webhooks/sms')
 * @TwilioWebhook()
 * @UseInterceptors(TwimlInterceptor)
 * handleSms(@Body() payload: TwilioIncomingMessagePayload) {
 *   const reply = new twilio.twiml.MessagingResponse();
 *   reply.message(`Thanks, ${payload.ProfileName ?? payload.From}`);
 *   return reply;
 * }
 * ```
 *
 * @see https://www.twilio.com/docs/messaging/guides/webhook-request
 */
export interface TwilioIncomingMessagePayload
  extends
    TwilioMediaParams,
    TwilioGeoParams,
    TwilioWhatsAppParams,
    TwilioRichMessageParams,
    TwilioLocationParams {
  /** 34-character unique identifier for the message, prefixed `SM` or `MM`. */
  readonly MessageSid: string;
  /** SID of the account that received the message. Starts with `AC`. */
  readonly AccountSid: string;
  /** Sender's phone number or channel address. */
  readonly From: string;
  /** Recipient's phone number or channel address. */
  readonly To: string;
  /** Message text, up to 1600 characters. */
  readonly Body: string;
  /** Number of message segments, as a string. Always `'1'` off SMS/MMS. */
  readonly NumSegments?: string;
  /** SID of the Messaging Service involved, if any. Starts with `MG`. */
  readonly MessagingServiceSid?: string;
  /** @deprecated Identical to {@link MessageSid}; kept for compatibility. */
  readonly SmsSid?: string;
  /** @deprecated Identical to {@link MessageSid}; kept for compatibility. */
  readonly SmsMessageSid?: string;
}

/**
 * Body of a message `StatusCallback` request, sent as an outbound message
 * moves through its lifecycle.
 *
 * No callback is sent for a message's *initial* status; the first you receive
 * reflects a change after creation.
 *
 * @example
 * ```ts
 * @Post('webhooks/message-status')
 * @TwilioWebhook()
 * handleStatus(@Body() payload: TwilioMessageStatusPayload) {
 *   if (payload.MessageStatus === 'failed' || payload.MessageStatus === 'undelivered') {
 *     this.logger.warn(`${payload.MessageSid} failed with ${payload.ErrorCode}`);
 *   }
 * }
 * ```
 *
 * @see https://www.twilio.com/docs/messaging/guides/track-outbound-message-status
 */
export interface TwilioMessageStatusPayload extends TwilioGeoParams {
  readonly MessageSid: string;
  readonly AccountSid: string;
  readonly From: string;
  readonly To?: string;
  /** Status of the Message when the callback was sent. */
  readonly MessageStatus: TwilioMessageStatus;
  /** Twilio error code, present when delivery failed. A string, e.g. `'30008'`. */
  readonly ErrorCode?: string;
  /** Carrier's done-date from the delivery receipt, in `YYMMDDhhmm` format. */
  readonly RawDlrDoneDate?: string;
  /** SID of the Installed Channel used, on non-SMS channels. */
  readonly ChannelInstallSid?: string;
  /** Error message from the channel, present only when delivery failed. */
  readonly ChannelStatusMessage?: string;
  /** Channel-specific prefix identifying the messaging channel. */
  readonly ChannelPrefix?: string;
  /** Post-delivery event. `'READ'` once a read receipt arrives. */
  readonly EventType?: string;
  /** @deprecated Identical to {@link MessageSid}; kept for compatibility. */
  readonly SmsSid?: string;
  /** @deprecated Identical to {@link MessageStatus}; kept for compatibility. */
  readonly SmsStatus?: TwilioMessageStatus;
}

/**
 * Body of Twilio's request when a call arrives, and of any subsequent request
 * to a TwiML `action` URL.
 *
 * @example
 * ```ts
 * @Post('webhooks/voice')
 * @TwilioWebhook()
 * @UseInterceptors(TwimlInterceptor)
 * answer(@Body() payload: TwilioIncomingCallPayload) {
 *   const response = new twilio.twiml.VoiceResponse();
 *   response.say(`Hello from ${payload.FromCity ?? 'an unknown city'}`);
 *   return response;
 * }
 * ```
 *
 * @see https://www.twilio.com/docs/voice/twiml#request-parameters
 */
export interface TwilioIncomingCallPayload extends TwilioGeoParams {
  /** Unique identifier for the call. Starts with `CA`. */
  readonly CallSid: string;
  /** SID of the account handling the call. Starts with `AC`. */
  readonly AccountSid: string;
  /**
   * Caller's number or client identifier. Client identifiers use the
   * `client:` scheme, e.g. `client:charlie`. May be `anonymous` or `unknown`
   * when caller ID is withheld.
   */
  readonly From: string;
  /** Called number or client identifier. */
  readonly To: string;
  readonly CallStatus: TwilioCallStatus;
  readonly Direction: TwilioCallDirection;
  /** Twilio API version handling the call, e.g. `'2010-04-01'`. */
  readonly ApiVersion?: string;
  /** Number the call was forwarded from, when the carrier supplies it. */
  readonly ForwardedFrom?: string;
  /** Caller's name, when the number has caller-ID lookup enabled. */
  readonly CallerName?: string;
  /** SID of the call that created this leg. Absent on a first leg. */
  readonly ParentCallSid?: string;
  /** Token required to invoke a forwarded call. */
  readonly CallToken?: string;
}

/**
 * Body of a call `StatusCallback` request.
 *
 * Extends the inbound-call parameters with the fields Twilio adds once a call
 * has completed.
 *
 * @see https://www.twilio.com/docs/voice/api/call-resource#statuscallback
 */
export interface TwilioCallStatusPayload extends TwilioIncomingCallPayload {
  /** Call duration in seconds, as a string. Present once completed. */
  readonly CallDuration?: string;
  /** Duration Twilio billed for, in seconds, as a string. */
  readonly Duration?: string;
  /** Timestamp the call started, in RFC 2822 format. */
  readonly Timestamp?: string;
  /** SIP response code for the call's outcome, e.g. `'200'`. */
  readonly SipResponseCode?: string;
  /** URL of the recording, when the call was recorded. */
  readonly RecordingUrl?: string;
  /** SID of the recording. Starts with `RE`. */
  readonly RecordingSid?: string;
  /** Recording length in seconds, as a string. */
  readonly RecordingDuration?: string;
}
