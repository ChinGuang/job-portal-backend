import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StrategyName } from '../constants/strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard(StrategyName.SUPABASE_JWT) {}
