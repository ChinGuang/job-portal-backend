import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { StrategyName } from '../../common/constants/strategy';
import { WebhookSecretGuard } from '../../common/guards/webhook-secret.guard';
import { SupabaseJwtStrategy } from '../../common/strategies/supabase-jwt.strategy';
import { EmployerProfileModule } from '../profiles/modules/employee-profile/employer-profile.module';
import { UserModule } from '../users/user.module';
import { AuthController } from './auth.controller';
import { SupabaseUsersWebhookController } from './webhooks/supabase-users-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: StrategyName.SUPABASE_JWT }),
    UserModule,
    EmployerProfileModule,
  ],
  providers: [SupabaseJwtStrategy, WebhookSecretGuard],
  controllers: [AuthController, SupabaseUsersWebhookController],
  exports: [PassportModule],
})
export class AuthModule {}
