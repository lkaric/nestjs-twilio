import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        // Required for JSON webhooks. Twilio signs those with a bodySHA256 query
        // parameter, and the guard needs the exact bytes received to verify the
        // hash — a re-serialized body will not match.
        rawBody: true,
    });
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
    Logger.log(`Listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
