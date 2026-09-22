import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { InjectTwilio, type TwilioClient } from 'nestjs-twilio';
// Imported from the subpath, not the package root: @nestjs/terminus is an
// optional peer, so the indicator is only reachable for apps that installed it.
import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly twilio: TwilioHealthIndicator,
    @InjectTwilio('billing') private readonly billing: TwilioClient
  ) {}

  /**
   * Checks both registered clients.
   *
   * Each probe fetches its own Account resource, so a failure means either
   * Twilio is unreachable or those credentials are no longer accepted.
   *
   * The Twilio SDK does not accept an `AbortSignal`, so `withTimeout()` marks
   * the indicator down without cancelling the in-flight request. Set the SDK's
   * own `timeout` client option to bound it — this example does not, to keep
   * the module configuration minimal.
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.twilio.isHealthy('twilio').withTimeout(5000),
      () => this.twilio.isHealthy('twilio-billing', this.billing).withTimeout(5000),
    ]);
  }
}
