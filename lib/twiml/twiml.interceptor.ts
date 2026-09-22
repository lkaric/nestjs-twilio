import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { map, Observable } from 'rxjs';

// `twilio` is CommonJS and ships no `exports` map, so a deep path such as
// 'twilio/lib/twiml/TwiML' resolves under CJS but throws under Node's ESM
// loader. A default import is the only interop-safe form, and the package root
// is the only entry point Twilio treats as stable.
import twilio from 'twilio';

/** Every concrete TwiML builder the SDK exposes from its package root. */
type TwimlResponse =
  | InstanceType<typeof twilio.twiml.VoiceResponse>
  | InstanceType<typeof twilio.twiml.MessagingResponse>
  | InstanceType<typeof twilio.twiml.FaxResponse>;

/**
 * Metadata key under which {@link TwimlResponseType} stores its per-route
 * `Content-Type` override. Read back by {@link TwimlInterceptor} through a
 * `Reflector`.
 *
 * Exported so you can read the same metadata from your own guard or
 * interceptor rather than duplicating the key as a string literal.
 *
 * @example
 * ```ts
 * const contentType = reflector.getAllAndOverride<string>(
 *   TWIML_RESPONSE_TYPE_METADATA,
 *   [context.getHandler(), context.getClass()],
 * );
 * ```
 */
export const TWIML_RESPONSE_TYPE_METADATA = 'nestjs-twilio:twiml-response-type';

/**
 * The `Content-Type` header {@link TwimlInterceptor} sets when neither a
 * {@link TwimlResponseType} decorator nor a constructor option overrides it.
 *
 * Twilio's own documentation uses `text/xml`; `application/xml` is also
 * accepted, which is why the value is overridable.
 *
 * @example
 * ```ts
 * // Restore the default explicitly on one route.
 * @Post('/voice')
 * @TwimlResponseType(DEFAULT_TWIML_CONTENT_TYPE)
 * voice() {
 *   return new VoiceResponse();
 * }
 * ```
 */
export const DEFAULT_TWIML_CONTENT_TYPE = 'text/xml';

/**
 * Injection token for a module-wide {@link TwimlInterceptorOptions} default.
 *
 * Provide it when registering the interceptor globally, where there is no
 * constructor call to pass options to. Optional: when absent, the interceptor
 * falls back to {@link DEFAULT_TWIML_CONTENT_TYPE}.
 *
 * @example
 * ```ts
 * @Module({
 *   providers: [
 *     { provide: TWIML_INTERCEPTOR_OPTIONS, useValue: { contentType: 'application/xml' } },
 *     { provide: APP_INTERCEPTOR, useClass: TwimlInterceptor },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export const TWIML_INTERCEPTOR_OPTIONS = Symbol.for('nestjs-twilio:twiml-interceptor-options');

/**
 * Options accepted by the {@link TwimlInterceptor} constructor.
 *
 * @example
 * ```ts
 * new TwimlInterceptor({ contentType: 'application/xml' });
 * ```
 */
export interface TwimlInterceptorOptions {
  /**
   * The `Content-Type` header written for every serialized TwiML response,
   * unless overridden per-route by {@link TwimlResponseType}.
   *
   * @default 'text/xml'
   */
  contentType?: 'text/xml' | 'application/xml';
}

/**
 * The minimal response contract `TwimlInterceptor` relies on. Both
 * `express.Response#header` and `fastify.FastifyReply#header` satisfy this
 * shape, so the interceptor never needs to import either platform's types
 * (and therefore never forces either adapter as a hard dependency).
 */
interface TwimlCapableResponse {
  header(name: string, value: string): unknown;
}

/**
 * Route-level (or controller-method-level) override for the `Content-Type`
 * header {@link TwimlInterceptor} writes when it serializes a TwiML
 * response returned from that handler. Takes precedence over the
 * interceptor's constructor option and its built-in default.
 *
 * @param contentType - The `Content-Type` header to use for this handler's
 * TwiML responses. Omit to fall back to the interceptor's own configuration.
 *
 * @example
 * ```ts
 * @Controller('voice')
 * @UseInterceptors(TwimlInterceptor)
 * export class VoiceController {
 *   @Post('incoming')
 *   @TwimlResponseType('application/xml')
 *   handleIncomingCall(): VoiceResponse {
 *     const response = new VoiceResponse();
 *     response.say('Hello from NestJS');
 *     return response;
 *   }
 * }
 * ```
 */
export function TwimlResponseType(contentType?: string): MethodDecorator {
  return SetMetadata<string, string | undefined>(TWIML_RESPONSE_TYPE_METADATA, contentType);
}

/**
 * Type guard identifying Twilio TwiML builder instances: `VoiceResponse`,
 * `MessagingResponse` or `FaxResponse`.
 *
 * Checked against the three concrete builders exported from the `twilio`
 * package root rather than their shared base class, which is reachable only
 * through a deep import that breaks under ESM.
 * @param value - The controller return value to inspect.
 *
 * @example
 * ```ts
 * if (isTwimlResponse(value)) {
 *   response.header('Content-Type', 'text/xml');
 *   return value.toString();
 * }
 * ```
 */
export function isTwimlResponse(value: unknown): value is TwimlResponse {
  return (
    value instanceof twilio.twiml.VoiceResponse ||
    value instanceof twilio.twiml.MessagingResponse ||
    value instanceof twilio.twiml.FaxResponse
  );
}

/**
 * Serializes Twilio TwiML builder responses (`VoiceResponse`,
 * `MessagingResponse`, `FaxResponse`) returned from a controller handler
 * into their XML string representation, and sets the matching
 * `Content-Type` header on the underlying HTTP response.
 *
 * Non-TwiML return values are passed through unchanged, so the interceptor
 * is safe to register globally alongside handlers that return plain JSON.
 * It works identically on the Express and Fastify platform adapters, since
 * it only relies on the `response.header()` method both implement, and it
 * never touches the response status code or any other header.
 *
 * @example Registered globally, using the default content type
 * ```ts
 * app.useGlobalInterceptors(new TwimlInterceptor());
 * ```
 *
 * @example Registered per-route, overriding the default content type
 * ```ts
 * @Post('incoming')
 * @UseInterceptors(new TwimlInterceptor({ contentType: 'application/xml' }))
 * handleIncomingCall(): MessagingResponse {
 *   const response = new MessagingResponse();
 *   response.message('Thanks for texting us!');
 *   return response;
 * }
 * ```
 *
 * @example Registered as a provider, with a per-route override
 * ```ts
 * providers: [{ provide: APP_INTERCEPTOR, useClass: TwimlInterceptor }];
 * ```
 */
@Injectable()
export class TwimlInterceptor implements NestInterceptor {
  private readonly reflector = new Reflector();

  private readonly contentType: string;

  // A default parameter value is not enough: `emitDecoratorMetadata` still
  // records `Object` as the parameter type, so Nest tries to resolve it as a
  // provider and fails whenever the interceptor is used as a class reference,
  // e.g. `@UseInterceptors(TwimlInterceptor)`. `@Optional()` tells Nest the
  // dependency may be absent; `@Inject()` names a token it can actually look
  // up when someone does want to configure it.
  constructor(
    @Optional()
    @Inject(TWIML_INTERCEPTOR_OPTIONS)
    options: TwimlInterceptorOptions = {}
  ) {
    this.contentType = options?.contentType ?? DEFAULT_TWIML_CONTENT_TYPE;
  }

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (!isTwimlResponse(data) || context.getType() !== 'http') {
          return data;
        }

        const contentType =
          this.reflector.get<string | undefined, string>(
            TWIML_RESPONSE_TYPE_METADATA,
            context.getHandler()
          ) ?? this.contentType;

        context
          .switchToHttp()
          .getResponse<TwimlCapableResponse>()
          .header('Content-Type', contentType);

        return data.toString();
      })
    );
  }
}
