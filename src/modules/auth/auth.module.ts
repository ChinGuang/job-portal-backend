import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { StrategyName } from '../../common/constants/strategy';
import { SupabaseJwtStrategy } from '../../common/strategies/supabase-jwt.strategy';
import { UserModule } from '../users/user.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: StrategyName.SUPABASE_JWT }),
    UserModule,
  ],
  providers: [SupabaseJwtStrategy],
  controllers: [AuthController],
  exports: [PassportModule],
})
export class AuthModule {}
