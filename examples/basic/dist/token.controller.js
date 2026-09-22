var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Query } from '@nestjs/common';
import { TwilioTokenService } from 'nestjs-twilio';
/**
 * Mints Access Tokens for Twilio's client-side SDKs.
 *
 * A browser or mobile app calls these endpoints, receives a short-lived JWT,
 * and uses it to talk to Twilio directly. Your account credentials never
 * leave the server.
 *
 * Tokens are signed with an API key, so these routes mint against the
 * `realtime` client, which is registered with `apiKey` / `apiSecret`. Minting
 * against the default client here would fail loudly, because it authenticates
 * with an auth token.
 */
let TokenController = class TokenController {
    tokens;
    constructor(tokens) {
        this.tokens = tokens;
    }
    /** Voice token. Identity is restricted to letters, digits and underscores. */
    voice(identity) {
        return {
            token: this.tokens.createVoiceToken({
                identity,
                incomingAllow: true,
                // Ten minutes: long enough to place a call, short enough that a
                // leaked token is not worth much.
                ttl: 600,
            }, 'realtime'),
        };
    }
    /** Video token, optionally scoped to a single room. */
    video(identity, room) {
        return {
            token: this.tokens.createVideoToken({ identity, room, ttl: 600 }, 'realtime'),
        };
    }
};
__decorate([
    Get('voice'),
    __param(0, Query('identity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], TokenController.prototype, "voice", null);
__decorate([
    Get('video'),
    __param(0, Query('identity')),
    __param(1, Query('room')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Object)
], TokenController.prototype, "video", null);
TokenController = __decorate([
    Controller('token'),
    __metadata("design:paramtypes", [TwilioTokenService])
], TokenController);
export { TokenController };
