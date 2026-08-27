import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from '../../../common/constants/swagger';
import {
  WEBHOOK_SECRET_HEADER,
  WebhookSecretGuard,
} from '../../../common/guards/webhook-secret.guard';
import { EmployerProfileRepoService } from '../../profiles/modules/employee-profile/employer-profile-repo.service';
import { UserRepoService } from '../../users/services/user-repo.service';
import {
  MIRRORED_TABLE,
  SUPABASE_DATABASE_EVENT,
  SupabaseUserWebhookDto,
} from './supabase-user-webhook.dto';

@ApiTags(SwaggerTag.WEBHOOKS)
@Controller('webhooks/supabase')
export class SupabaseUsersWebhookController {
  constructor(
    private readonly userRepoService: UserRepoService,
    private readonly employerProfileRepoService: EmployerProfileRepoService,
  ) {}
  private readonly logger = new Logger(SupabaseUsersWebhookController.name);
  @Post('users')
  @UseGuards(WebhookSecretGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mirror a Supabase auth.users change into the local user table',
    description:
      'INSERT and UPDATE upsert the mirrored user; DELETE soft-deletes it. ' +
      'Event types and tables this endpoint does not handle still return 200 ' +
      'so Supabase stops retrying.',
  })
  @ApiHeader({
    name: WEBHOOK_SECRET_HEADER,
    description: 'Shared secret agreed with Supabase.',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Event accepted or ignored.' })
  @ApiResponse({
    status: 401,
    description: 'Shared secret missing or incorrect.',
  })
  async handleUserEvent(
    @Body() payload: SupabaseUserWebhookDto,
  ): Promise<{ received: true }> {
    if (payload.table !== MIRRORED_TABLE) {
      return { received: true };
    }

    switch (payload.type) {
      case SUPABASE_DATABASE_EVENT.INSERT:
      case SUPABASE_DATABASE_EVENT.UPDATE: {
        const supabaseId = payload.record?.id;
        const email = payload.record?.email;

        if (typeof supabaseId === 'string' && typeof email === 'string') {
          await this.userRepoService.upsertBySupabaseId({ supabaseId, email });
        }
        break;
      }
      case SUPABASE_DATABASE_EVENT.DELETE: {
        const supabaseId = payload.old_record?.id;

        if (typeof supabaseId === 'string') {
          const user =
            await this.userRepoService.softDeleteBySupabaseId(supabaseId);
          // Soft-removing the profile cascades the deleted employer's
          // listings to ARCHIVED via the profile subscriber.
          if (user) {
            await this.employerProfileRepoService.softDeleteByUserId(user.id);
          }
        }
        break;
      }
      default:
        // Anything else is an event type this endpoint deliberately ignores.
        this.logger.warn(
          `${this.handleUserEvent.name}: Unknown Supabase Database event: ${payload.type}`,
        );
        break;
    }
    return { received: true };
  }
}
