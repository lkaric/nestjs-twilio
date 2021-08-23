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

The simplest way to use `nestjs-twilio` is to use `TwilioModule.forRoot`

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

Utilizing asynchronous providers

```typescript
import { TwilioModule } from 'nestjs-twilio';

@Module({
  imports: [
    TwilioModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (cfg: ConfigService) => ({
        accountSid: cfg.get('TWILIO_ACCOUNT_SID'),
        authToken: cfg.get('TWILIO_AUTH_TOKEN'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

You can then inject the Twilio client into any of your injectables by using a
custom decorator

```typescript
import { InjectTwilio, TwilioClient } from 'nestjs-twilio';

@Injectable()
export class AppService {
  public constructor(@InjectTwilio() private readonly client: TwilioClient) {}

  async sendSMS() {
    try {
      return await this.client.messages.create({
        body: 'SMS Body, sent to the phone!',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: TARGET_PHONE_NUMBER,
      });
    } catch (e) {
      return e;
    }
  }
}
```
## Testing

Example of testing can be found [here](https://github.com/rejvban/nestjs-twilio/blob/master/lib/__tests__/twilio.decorators.test.ts).