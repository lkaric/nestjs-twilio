## [5.0.1](https://github.com/lkaric/nestjs-twilio/compare/v5.0.0...v5.0.1) (2026-09-22)


### Bug Fixes

* **exception:** stop treating every Nest HttpException as a Twilio error ([#134](https://github.com/lkaric/nestjs-twilio/issues/134)) ([802d3f3](https://github.com/lkaric/nestjs-twilio/commit/802d3f3117b46bf8afd7fb6c7a57bad0f4b41ed9))

# [5.0.0](https://github.com/lkaric/nestjs-twilio/compare/v4.4.0...v5.0.0) (2026-09-22)


* feat(module)!: replace forFeature with registerClient, inheriting root options ([9749f50](https://github.com/lkaric/nestjs-twilio/commit/9749f504bea439ff7d3f643a6ef0752e4226f01a))
* fix(module)!: make API key authentication actually work ([65d7938](https://github.com/lkaric/nestjs-twilio/commit/65d7938925191ef89ecefe9a22677a66f690c00c)), closes [#84](https://github.com/lkaric/nestjs-twilio/issues/84)


### Bug Fixes

* **ci:** publish with the npm token the repository actually defines ([551adfa](https://github.com/lkaric/nestjs-twilio/commit/551adfa392748afebeffe183fd333e4e4d4a8457)), closes [#105](https://github.com/lkaric/nestjs-twilio/issues/105)
* **ci:** use a conventional-changelog preset that exists ([552db2f](https://github.com/lkaric/nestjs-twilio/commit/552db2f7b3f2e0d39a66cc2879fe3015a33d1bec))


### Features

* **example:** add a runnable example app, and fix the defects it found ([049348e](https://github.com/lkaric/nestjs-twilio/commit/049348edb903a3c34ae284d8af92f8ce47854c75)), closes [#104](https://github.com/lkaric/nestjs-twilio/issues/104)
* **exception:** add TwilioExceptionFilter for error mapping ([272b4e5](https://github.com/lkaric/nestjs-twilio/commit/272b4e5d30e778691f0ddf383278e1a96610c87d)), closes [#83](https://github.com/lkaric/nestjs-twilio/issues/83)
* **module:** refactor TwilioModule with ConfigurableModuleBuilder ([d69df68](https://github.com/lkaric/nestjs-twilio/commit/d69df684a4799af35bb534e536505255874c3d16)), closes [#87](https://github.com/lkaric/nestjs-twilio/issues/87) [#88](https://github.com/lkaric/nestjs-twilio/issues/88) [#89](https://github.com/lkaric/nestjs-twilio/issues/89)
* **terminus:** add a Twilio health indicator behind an optional subpath ([eae65dc](https://github.com/lkaric/nestjs-twilio/commit/eae65dc78e50a6b8efa5761ad935f06ec38ab1b3)), closes [#86](https://github.com/lkaric/nestjs-twilio/issues/86)
* **token:** add TwilioTokenService for Voice, Video, Chat and Sync ([29d253a](https://github.com/lkaric/nestjs-twilio/commit/29d253aa5e5ca114dffa2999880b881d66f2e3ac))
* **twiml:** add TwiMLInterceptor for response serialization ([0ca0fb3](https://github.com/lkaric/nestjs-twilio/commit/0ca0fb37155045444c5f200ae3d0b6445cc263c9)), closes [#82](https://github.com/lkaric/nestjs-twilio/issues/82)
* **webhook:** add TwilioWebhookGuard for signature validation ([5e83150](https://github.com/lkaric/nestjs-twilio/commit/5e83150baafd215820d7914c99488b81ffe86078)), closes [#81](https://github.com/lkaric/nestjs-twilio/issues/81)
* **webhook:** add typed payload interfaces for Twilio callbacks ([c891b5a](https://github.com/lkaric/nestjs-twilio/commit/c891b5a89138ccd255edc0af831b1ecd6c9dad9b)), closes [#85](https://github.com/lkaric/nestjs-twilio/issues/85)


### BREAKING CHANGES

* `apiSecret` is now required whenever `apiKey` is supplied.
Configuration that previously "worked" in the sense of constructing without
error, but produced a client that could not authenticate, is now rejected at
startup.

Tests: lib/__tests__/twilio.auth.test.ts pins the username/password/accountSid
mapping for both modes, which is the assertion whose absence let this ship.
It replaces twilio.validation.test.ts, whose credential cases asserted the
broken contract ("should accept apiKey" with no secret) and which used `as any`
seven times. The suite now has no `as any` anywhere.
* `forFeature(name, options)` becomes
`registerClient({ name, ...options })`, and `forFeatureAsync` becomes
`registerClientAsync`. The `isGlobal` option is removed: `forRoot()` now always
registers globally, as `TypeOrmCoreModule`, Mongoose's core module and
`BullModule.forRoot()` all do. `TwilioModuleDefinitionExtras` is gone.

Details:

- Named clients inherit every option from `forRoot()` they do not override.
- Only *defined* values override. A key present but `undefined` inherits, which
  deliberately differs from the plain object spread bullmq uses: configuration
  is typically read from the environment, and `region: process.env.REGION` is
  `undefined` when unset, which under a spread would silently clear an
  inherited region. Nothing is lost, since returning a client to the default is
  expressed by naming it (`region: 'us1'`).
- The root must be global for a named client to reach the shared options, since
  each client is registered as its own module. Making that a user-settable flag
  would mean inheritance silently stopped working when it was switched off.
- `registerClientAsync` reaches parity with Nest's generated async methods,
  accepting `useFactory`, `useClass`, `useExisting`, `inject` and `imports`.
  The previous `forFeatureAsync` supported only `useFactory`.
- `createTwilioClient` no longer forwards `webhookAuthToken` and `webhookUrl`
  into the SDK's `ClientOpts`; they are module-level settings the SDK has no
  concept of.

Tests, README, MIGRATION.md, the documentation site and the example app are
updated. New regression tests cover transport inheritance, the
environment-variable `undefined` case, explicit overrides, registration with no
`forRoot`, and `useClass` in the async path.

# Changelog

This project adheres to [Semantic Versioning](http://semver.org).  
Every release, along with the migration instructions, is documented on the Github [Releases](https://github.com/rejvban/twilio-nestjs/releases) page
