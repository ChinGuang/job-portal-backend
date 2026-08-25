import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/** The table this webhook mirrors. Events on any other table are ignored. */
export const MIRRORED_TABLE = 'users';

export enum SUPABASE_DATABASE_EVENT {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
/**
 * `type` is deliberately a plain string rather than an enum: Supabase may
 * deliver event types this endpoint doesn't handle, and those must return 2xx
 * rather than fail validation and be retried forever.
 */
export class SupabaseUserWebhookDto {
  @ApiProperty({ example: 'INSERT', description: 'Supabase event type' })
  @IsString()
  type!: SUPABASE_DATABASE_EVENT;

  @ApiProperty({ example: 'users', description: 'Source table' })
  @IsString()
  table!: string;

  @ApiPropertyOptional({ example: 'auth', description: 'Source schema' })
  @IsOptional()
  @IsString()
  schema?: string;

  @ApiPropertyOptional({
    description: 'Row after the change. Present on INSERT and UPDATE.',
  })
  @IsOptional()
  @IsObject()
  record?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'Row before the change. Present on UPDATE and DELETE.',
  })
  @IsOptional()
  @IsObject()
  old_record?: Record<string, unknown> | null;
}
