<p align="center">
  <h3 align="center">
    nestjs-twilio
  </h3>

  <p align="center">
    <img src="https://avatars1.githubusercontent.com/u/43827489?s=400&u=45ac0ac47d40b6d8f277c96bdf00244c10508aef&v=4"/>
  </p>

  <p align="center">
    Injectable Twilio client for [Nestjs](https://nestjs.com/).
  </p>
</p>

Implementing the `TwilioModule` from this package you gain access to Twilio client through dependency injection with minimal setup.

## Instalation

```bash
$ npm install --save nestjs-twilio
```

```bash
$ yarn add nestjs-twilio
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
      return await this.client.message.create({
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
