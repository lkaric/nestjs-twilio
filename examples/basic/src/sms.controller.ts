import { Body, Controller, Get, Post, UseFilters } from '@nestjs/common';
import { TwilioExceptionFilter } from 'nestjs-twilio';

import { BillingService } from './billing.service.js';
import { SmsService } from './sms.service.js';

interface SendSmsDto {
  to: string;
  body: string;
}

// Any RestException the Twilio SDK throws below is mapped to an HTTP response
// carrying Twilio's own error code and more_info URL, instead of surfacing as
// an unhandled 500.
@Controller('sms')
@UseFilters(TwilioExceptionFilter)
export class SmsController {
  constructor(
    private readonly sms: SmsService,
    private readonly billing: BillingService
  ) {}

  @Post()
  async send(@Body() dto: SendSmsDto): Promise<{ sid: string }> {
    return { sid: await this.sms.send(dto.to, dto.body) };
  }

  /**
   * Proves the two registered clients are distinct instances with their own
   * credentials — the point of registerClient().
   */
  @Get('accounts')
  accounts(): { default: string; billing: string } {
    return {
      default: this.sms.describeAccount(),
      billing: this.billing.describeAccount(),
    };
  }
}
