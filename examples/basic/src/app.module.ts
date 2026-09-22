import { Module } from '@nestjs/common';
import { TwilioModule } from 'nestjs-twilio';

import { BillingService } from './billing.service.js';
import { SmsController } from './sms.controller.js';
import { SmsService } from './sms.service.js';
import { WebhookController } from './webhook.controller.js';

@Module({
  imports: [
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

      isGlobal: true,
    }),

    // A second, independently credentialed client for a subaccount. Injected
    // with @InjectTwilio('billing').
    TwilioModule.forFeature('billing', {
      accountSid: process.env.TWILIO_BILLING_ACCOUNT_SID ?? 'ACyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
      authToken: process.env.TWILIO_BILLING_AUTH_TOKEN ?? 'example_billing_token',
    }),
  ],
  controllers: [SmsController, WebhookController],
  providers: [SmsService, BillingService],
})
export class AppModule {}
