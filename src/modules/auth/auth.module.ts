import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StrategyName } from '../../common/constants/strategy';
import { SupabaseJwtStrategy } from '../../common/strategies/supabase-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: StrategyName.SUPABASE_JWT }),
  ],
  providers: [SupabaseJwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
