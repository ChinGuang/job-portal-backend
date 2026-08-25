import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepoService } from '../../modules/users/services/user-repo.service';
import { EnvKey } from '../constants/config';
import { StrategyName } from '../constants/strategy';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  StrategyName.SUPABASE_JWT,
) {
  constructor(
    configService: ConfigService,
    private readonly userRepoService: UserRepoService,
  ) {
    const supabaseUrl = configService.get<string>(EnvKey.SUPABASE_URL);

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
  async validate(payload: Record<string, unknown>) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const email = payload.email;
    const supabaseId = payload.sub;
    if (typeof email == 'string' && typeof supabaseId == 'string') {
      const user = await this.userRepoService.findOrCreateFromToken({
        supabaseId,
        email,
      });

      if (!user) throw new UnauthorizedException('User deleted');
      return user;
    }
    throw new UnauthorizedException('Invalid token payload');
  }
}
