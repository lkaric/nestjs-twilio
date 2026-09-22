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
import { Body, Controller, Get, Post, UseFilters } from '@nestjs/common';
import { TwilioExceptionFilter } from 'nestjs-twilio';
import { BillingService } from './billing.service.js';
import { SmsService } from './sms.service.js';
// Any RestException the Twilio SDK throws below is mapped to an HTTP response
// carrying Twilio's own error code and more_info URL, instead of surfacing as
// an unhandled 500.
let SmsController = class SmsController {
    sms;
    billing;
    constructor(sms, billing) {
        this.sms = sms;
        this.billing = billing;
    }
    async send(dto) {
        return { sid: await this.sms.send(dto.to, dto.body) };
    }
    /**
     * Proves the two registered clients are distinct instances with their own
     * credentials — the point of forFeature().
     */
    accounts() {
        return {
            default: this.sms.describeAccount(),
            billing: this.billing.describeAccount(),
        };
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SmsController.prototype, "send", null);
__decorate([
    Get('accounts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SmsController.prototype, "accounts", null);
SmsController = __decorate([
    Controller('sms'),
    UseFilters(TwilioExceptionFilter),
    __metadata("design:paramtypes", [SmsService,
        BillingService])
], SmsController);
export { SmsController };
