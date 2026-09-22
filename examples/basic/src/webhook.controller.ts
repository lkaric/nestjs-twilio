import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { TwilioWebhook, TwimlInterceptor, TwimlResponseType } from 'nestjs-twilio';
import twilio from 'twilio';

/**
 * The subset of Twilio's inbound-SMS callback this example reads.
 *
 * Typed payload interfaces for the full set of callbacks are tracked in #85;
 * until then, declare what you use.
 */
interface InboundSmsPayload {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}

@Controller('webhooks')
export class WebhookController {
  /**
   * Signature-validated, and replies with TwiML.
   *
   * `@TwilioWebhook()` rejects any request Twilio did not sign.
   * `TwimlInterceptor` serializes the returned builder to XML and sets the
   * Content-Type, so the handler returns an object rather than a string.
   */
  @Post('sms')
  @TwilioWebhook()
  @UseInterceptors(TwimlInterceptor)
  replyToSms(@Body() payload: InboundSmsPayload) {
    const response = new twilio.twiml.MessagingResponse();
    response.message(`Received "${payload.Body}" from ${payload.From}`);

    return response;
  }

  /**
   * Same guard, but answering a voice call and overriding the response
   * content type for this route only.
   */
  @Post('voice')
  @TwilioWebhook()
  @UseInterceptors(TwimlInterceptor)
  @TwimlResponseType('application/xml')
  answerCall() {
    const response = new twilio.twiml.VoiceResponse();
    response.say('Thanks for calling. This response came from nestjs-twilio.');

    return response;
  }

  /**
   * A webhook whose signature is validated against a subaccount's auth token
   * rather than the module-level default.
   */
  @Post('billing')
  @TwilioWebhook({ authToken: process.env.TWILIO_BILLING_AUTH_TOKEN })
  @UseInterceptors(TwimlInterceptor)
  acknowledgeBilling() {
    return new twilio.twiml.MessagingResponse();
  }
}
