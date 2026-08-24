import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { EnvKey } from '../constants/config';

export const WEBHOOK_SECRET_HEADER = 'x-webhook-secret';

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedSecret = request.headers[WEBHOOK_SECRET_HEADER];
    const expectedSecret = this.configService.get<string>(
      EnvKey.SUPABASE_WEBHOOK_SECRET,
    );

    if (
      !expectedSecret ||
      typeof providedSecret !== 'string' ||
      !safeCompare(providedSecret, expectedSecret)
    ) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
