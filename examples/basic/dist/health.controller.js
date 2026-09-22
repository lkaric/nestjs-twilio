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
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { InjectTwilio } from 'nestjs-twilio';
// Imported from the subpath, not the package root: @nestjs/terminus is an
// optional peer, so the indicator is only reachable for apps that installed it.
import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';
let HealthController = class HealthController {
    health;
    twilio;
    billing;
    constructor(health, twilio, billing) {
        this.health = health;
        this.twilio = twilio;
        this.billing = billing;
    }
    /**
     * Checks both registered clients.
     *
     * Each probe fetches its own Account resource, so a failure means either
     * Twilio is unreachable or those credentials are no longer accepted.
     *
     * The Twilio SDK does not accept an `AbortSignal`, so `withTimeout()` marks
     * the indicator down without cancelling the in-flight request. Set the SDK's
     * own `timeout` client option to bound it. This example does not, to keep
     * the module configuration minimal.
     */
    check() {
        return this.health.check([
            () => this.twilio.isHealthy('twilio').withTimeout(5000),
            () => this.twilio.isHealthy('twilio-billing', this.billing).withTimeout(5000),
        ]);
    }
};
__decorate([
    Get(),
    HealthCheck(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
HealthController = __decorate([
    Controller('health'),
    __param(2, InjectTwilio('billing')),
    __metadata("design:paramtypes", [HealthCheckService,
        TwilioHealthIndicator, Object])
], HealthController);
export { HealthController };
