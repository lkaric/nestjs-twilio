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
var SmsService_1;
import { Injectable, Logger } from '@nestjs/common';
import { InjectTwilio } from 'nestjs-twilio';
let SmsService = SmsService_1 = class SmsService {
    twilio;
    logger = new Logger(SmsService_1.name);
    // The raw SDK client, injected directly. TwilioService is also available if
    // you would rather depend on the wrapper and reach for `.client`.
    constructor(twilio) {
        this.twilio = twilio;
    }
    async send(to, body) {
        const from = process.env.TWILIO_PHONE_NUMBER;
        if (!from) {
            throw new Error('TWILIO_PHONE_NUMBER is not set.');
        }
        const message = await this.twilio.messages.create({ to, body, from });
        this.logger.log(`Queued message ${message.sid} to ${to}`);
        return message.sid;
    }
    /** Demonstrates that the injected client is the real SDK instance. */
    describeAccount() {
        return this.twilio.accountSid;
    }
};
SmsService = SmsService_1 = __decorate([
    Injectable(),
    __param(0, InjectTwilio()),
    __metadata("design:paramtypes", [Object])
], SmsService);
export { SmsService };
