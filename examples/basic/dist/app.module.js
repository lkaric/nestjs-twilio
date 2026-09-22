var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TwilioModule } from 'nestjs-twilio';
import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';
import { BillingService } from './billing.service.js';
import { HealthController } from './health.controller.js';
import { SmsController } from './sms.controller.js';
import { SmsService } from './sms.service.js';
import { WebhookController } from './webhook.controller.js';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [
            TerminusModule,
            // Default client. Every Twilio SDK client option is a top-level key here —
            // in v4 they were nested under `options`.
            TwilioModule.forRoot({
                accountSid: process.env.TWILIO_ACCOUNT_SID ?? 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                authToken: process.env.TWILIO_AUTH_TOKEN ?? 'example_auth_token',
                // Default for webhook signature validation. Individual routes can
                // override it with @TwilioWebhook({ authToken }).
                webhookAuthToken: process.env.TWILIO_AUTH_TOKEN,
                // Set this when the app runs behind a proxy or tunnel that rewrites the
                // Host header, so the guard reconstructs the URL Twilio actually signed.
                webhookUrl: process.env.PUBLIC_URL,
            }),
            // A second, independently credentialed client for a subaccount. It
            // inherits everything above that it does not override — region, edge,
            // logLevel and so on — and is injected with @InjectTwilio('billing').
            TwilioModule.registerClient({
                name: 'billing',
                accountSid: process.env.TWILIO_BILLING_ACCOUNT_SID ?? 'ACyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
                authToken: process.env.TWILIO_BILLING_AUTH_TOKEN ?? 'example_billing_token',
            }),
        ],
        controllers: [SmsController, WebhookController, HealthController],
        providers: [SmsService, BillingService, TwilioHealthIndicator],
    })
], AppModule);
export { AppModule };
