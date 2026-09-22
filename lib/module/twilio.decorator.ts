import { Inject } from '@nestjs/common';

import { getTwilioClientToken } from '../utils/index.js';

/**
 * Parameter decorator for injecting a Twilio client.
 *
 * Injects the Twilio SDK client directly, or a named client registered via `registerClient()`.
 *
 * @param name - Optional name of a client registered via `registerClient({ name, ... })`
 *
 * @example
 * ```ts
 * @Injectable()
 * export class CallService {
 *   constructor(@InjectTwilio() client: Twilio) {
 *     this.client = client;
 *   }
 *
 *   async makeCall(to: string) {
 *     return this.client.api.calls.create({
 *       from: '+1234567890',
 *       to,
 *       url: 'https://example.com/voice',
 *     });
 *   }
 * }
 * ```
 *
 * @example With a named client:
 * ```ts
 * @Injectable()
 * export class SubaccountService {
 *   constructor(
 *     @InjectTwilio('subaccount') subClient: Twilio,
 *   ) {
 *     this.client = subClient;
 *   }
 * }
 * ```
 */
export function InjectTwilio(name?: string): ParameterDecorator {
  return Inject(getTwilioClientToken(name));
}
