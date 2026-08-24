import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { StrategyName } from '../constants/strategy';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  StrategyName.SUPABASE_JWT,
) {
  constructor(configService: ConfigService) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');

    super({
      // 1. Retrieve key dynamically using JWKS with internal caching
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),

      // 2. Extract bearer token from incoming request header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // 3. Verify standard JWT claims
      issuer: `${supabaseUrl}/auth/v1`,
      algorithms: ['RS256'],
    });
  }

  // Runs only after cryptographic signature and expiration are verified locally
  validate(payload: Record<string, unknown>) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Returns decoded payload attached to req.user
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      appMetadata: payload.app_metadata,
      userMetadata: payload.user_metadata,
    };
  }
}
