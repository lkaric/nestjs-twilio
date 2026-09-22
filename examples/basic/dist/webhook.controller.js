var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { TwilioWebhook, TwimlInterceptor, TwimlResponseType } from 'nestjs-twilio';
import twilio from 'twilio';
let WebhookController = class WebhookController {
    /**
     * Signature-validated, and replies with TwiML.
     *
     * `@TwilioWebhook()` rejects any request Twilio did not sign.
     * `TwimlInterceptor` serializes the returned builder to XML and sets the
     * Content-Type, so the handler returns an object rather than a string.
     */
    replyToSms(payload) {
        const response = new twilio.twiml.MessagingResponse();
        response.message(`Received "${payload.Body}" from ${payload.From}`);
        return response;
    }
    /**
     * Same guard, but answering a voice call and overriding the response
     * content type for this route only.
     */
    answerCall() {
        const response = new twilio.twiml.VoiceResponse();
        response.say('Thanks for calling. This response came from nestjs-twilio.');
        return response;
    }
    /**
     * A webhook whose signature is validated against a subaccount's auth token
     * rather than the module-level default.
     */
    acknowledgeBilling() {
        return new twilio.twiml.MessagingResponse();
    }
};
__decorate([
    Post('sms'),
    TwilioWebhook(),
    UseInterceptors(TwimlInterceptor),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WebhookController.prototype, "replyToSms", null);
__decorate([
    Post('voice'),
    TwilioWebhook(),
    UseInterceptors(TwimlInterceptor),
    TwimlResponseType('application/xml'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WebhookController.prototype, "answerCall", null);
__decorate([
    Post('billing'),
    TwilioWebhook({ authToken: process.env.TWILIO_BILLING_AUTH_TOKEN }),
    UseInterceptors(TwimlInterceptor),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WebhookController.prototype, "acknowledgeBilling", null);
WebhookController = __decorate([
    Controller('webhooks')
], WebhookController);
export { WebhookController };
