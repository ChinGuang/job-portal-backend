import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from '../../../common/constants/swagger';
import { WebhookSecretGuard } from '../../../common/guards/webhook-secret.guard';
import { UserRepoService } from '../../users/services/user-repo.service';
import {
  SupabaseUserWebhookDto,
  SupabaseWebhookEventType,
} from './supabase-user-webhook.dto';

@ApiTags(SwaggerTag.WEBHOOKS)
@Controller('webhooks/supabase')
export class SupabaseUsersWebhookController {
  constructor(private readonly userRepoService: UserRepoService) {}

  @Post('users')
  @UseGuards(WebhookSecretGuard)
  @HttpCode(200)
  // Not part of the public API surface consumers integrate against.
  @ApiExcludeEndpoint()
  async handleUserEvent(
    @Body() payload: SupabaseUserWebhookDto,
  ): Promise<{ received: true }> {
    switch (payload.type as SupabaseWebhookEventType) {
      case SupabaseWebhookEventType.INSERT:
      case SupabaseWebhookEventType.UPDATE: {
        const id = payload.record?.id;
        const email = payload.record?.email;
        if (typeof id === 'string' && typeof email === 'string') {
          await this.userRepoService.upsertFromWebhook({
            supabaseId: id,
            email,
          });
        }
        break;
      }
      case SupabaseWebhookEventType.DELETE: {
        const id = payload.old_record?.id;
        if (typeof id === 'string') {
          await this.userRepoService.softDeleteBySupabaseId(id);
        }
        break;
      }
      default:
        // Ignored event type — fall through and still return 2xx so
        // Supabase stops retrying.
        break;
    }

    return { received: true };
  }
}
