// `twilio` is a CommonJS package. A named value import (`import { Twilio }`)
// type-checks, because the SDK's declarations use `export =` with a namespace,
// but it throws at runtime under ESM: Node's cjs-module-lexer cannot statically
// detect those names, so the export does not exist on the module namespace.
// A default import always yields `module.exports`, which is interop-safe.
import twilio from 'twilio';

import { TwilioClient } from './twilio.interface.js';
import { OPTIONS_TYPE } from './twilio.module-definition.js';

export function createTwilioClient({
  accountSid,
  authToken,
  options,
}: typeof OPTIONS_TYPE): TwilioClient {
  const client = new twilio.Twilio(accountSid, authToken, options);

  return client;
}
