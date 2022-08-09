<p align="center">
  <h3 align="center">
    nestjs-twilio
  </h3>

  <p align="center">
    <img src="https://avatars1.githubusercontent.com/u/43827489?s=400&u=45ac0ac47d40b6d8f277c96bdf00244c10508aef&v=4"/>
  </p>

  <p align="center">
    Injectable Twilio client for <a href="https://nestjs.com/">Nestjs</a>.
  </p>
</p>

[![build status](https://img.shields.io/github/workflow/status/rejvban/nestjs-twilio/Github%20CI%20-%20Build%20Status%20and%20Test%20Coverage)](https://github.com/wellyshen/use-places-autocomplete/actions?query=workflow%3ACI) [![codecov](https://codecov.io/gh/rejvban/nestjs-twilio/branch/master/graph/badge.svg)](https://codecov.io/gh/rejvban/nestjs-twilio) [![npm version](https://img.shields.io/npm/v/nestjs-twilio)](https://www.npmjs.com/package/nestjs-twilio) [![miniziped size](https://badgen.net/bundlephobia/minzip/nestjs-twilio)](https://bundlephobia.com/result?p=nestjs-twilio) [![tree shaking](https://badgen.net/bundlephobia/tree-shaking/react-colorful)](https://github.com/rejvban/nestjs-twilio) [![MIT licensed](https://img.shields.io/github/license/rejvban/nestjs-twilio)](https://raw.githubusercontent.com/rejvban/nestjs-twilio/master/LICENSE)

Implementing the `TwilioModule` from this package you gain access to Twilio client through dependency injection with minimal setup.

## Instalation

```bash
$ npm install --save twilio nestjs-twilio
```

```bash
$ yarn add twilio nestjs-twilio
```

## Getting Started

To use Twilio client we need to register module for example in app.module.ts

```typescript
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRoot({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    }),
  ],
})
export class AppModule {}
```

If you are using the `@nestjs/config package` from nest, you can use the `ConfigModule` using the `registerAsync()` function to inject your environment variables like this in your custom module:

```typescript
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        accountSid: cfg.get('TWILIO_ACCOUNT_SID'),
        authToken: cfg.get('TWILIO_AUTH_TOKEN'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

Example usage in service.

```typescript
import { InjectTwilio, TwilioService } from 'nestjs-twilio';

@Injectable()
export class AppService {
  public constructor(private readonly twilioService: TwilioService) {}

  async sendSMS() {
    return this.twilioService.client.messages.create({
      body: 'SMS Body, sent to the phone!',
      from: TWILIO_PHONE_NUMBER,
      to: TARGET_PHONE_NUMBER,
    });
  }
}
```

For full Client API see Twilio Node SDK reference [here](https://www.twilio.com/docs/libraries/node)

## :rotating_light: `@InjectTwilio()` decorator has been deprecated in v3

## Testing

Example of testing can be found [here](https://github.com/rejvban/nestjs-twilio/blob/master/lib/__tests__/twilio.module.test.ts).
