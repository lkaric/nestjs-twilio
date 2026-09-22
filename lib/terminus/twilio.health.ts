import { Inject, Injectable, Optional } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import { getTwilioClientToken } from '../utils/twilio.utils.js';

import type { TwilioClient } from '../utils/twilio.interface.js';

/**
 * Reports whether the Twilio API is reachable and the configured credentials
 * are accepted.
 *
 * Exposed from the `nestjs-twilio/terminus` subpath rather than the package
 * root. `@nestjs/terminus` is an optional peer dependency, and a root export
 * would make importing `nestjs-twilio` fail outright for the many consumers
 * who do not use health checks.
 *
 * @example
 * ```ts
 * import { Module } from '@nestjs/common';
 * import { TerminusModule } from '@nestjs/terminus';
 * import { TwilioHealthIndicator } from 'nestjs-twilio/terminus';
 *
 * @Module({
 *   imports: [TerminusModule],
 *   controllers: [HealthController],
 *   providers: [TwilioHealthIndicator],
 * })
 * export class HealthModule {}
 * ```
 *
 * @example Checking the default client
 * ```ts
 * @Get()
 * @HealthCheck()
 * check() {
 *   return this.health.check([() => this.twilio.isHealthy('twilio').withTimeout(3000)]);
 * }
 * ```
 */
@Injectable()
export class TwilioHealthIndicator {
  public constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    // Optional: an application may register only named clients, in which case
    // there is no default and every check must name the client to probe.
    @Optional()
    @Inject(getTwilioClientToken())
    private readonly defaultClient?: TwilioClient
  ) {}

  /**
   * Probe a Twilio client by fetching its own Account resource, which
   * exercises both network reachability and credential validity.
   *
   * Returns the attempt builder, so `withTimeout()` and `cacheFor()` can be
   * chained as with any Terminus indicator.
   *
   * The check is built on `attempt()` rather than `up()`/`down()` precisely
   * because the request can throw: Terminus turns a thrown error into a
   * `'down'` result, whereas an indicator written with `up()`/`down()` that
   * throws aborts the whole health check with a 500.
   *
   * @param key - Name this indicator appears under in the health report.
   * @param client - Client to probe. Defaults to the one from `forRoot()`.
   *
   * @example Probing a named client from `registerClient()`
   * ```ts
   * constructor(
   *   private readonly health: HealthCheckService,
   *   private readonly twilio: TwilioHealthIndicator,
   *   @InjectTwilio('billing') private readonly billing: TwilioClient,
   * ) {}
   *
   * @Get()
   * @HealthCheck()
   * check() {
   *   return this.health.check([
   *     () => this.twilio.isHealthy('twilio').withTimeout(3000),
   *     () => this.twilio.isHealthy('twilio-billing', this.billing).withTimeout(3000),
   *   ]);
   * }
   * ```
   */
  public isHealthy(key = 'twilio', client?: TwilioClient) {
    const target = client ?? this.defaultClient;

    return this.healthIndicatorService.check(key).attempt(async () => {
      if (!target) {
        throw new Error(
          'No Twilio client to check. Register one with TwilioModule.forRoot(), ' +
            'or pass a named client as the second argument.'
        );
      }

      const account = await target.api.v2010.accounts(target.accountSid).fetch();

      // A suspended or closed account authenticates successfully but cannot
      // send anything, so it is not healthy. Throwing here is deliberate:
      // attempt() records it as `down` with this message attached.
      if (account.status !== 'active') {
        throw new Error(`Twilio account status is "${account.status}"`);
      }

      return {
        accountSid: account.sid,
        friendlyName: account.friendlyName,
      };
    });
  }
}
