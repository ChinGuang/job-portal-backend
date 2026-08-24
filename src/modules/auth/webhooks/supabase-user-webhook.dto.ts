import { IsObject, IsOptional, IsString } from 'class-validator';

export enum SupabaseWebhookEventType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// `type` is deliberately a plain string, not the enum: Supabase may deliver
// event types this endpoint doesn't care about, and those must still 2xx
// rather than fail DTO validation.
export class SupabaseUserWebhookDto {
  @IsString()
  type!: string;

  @IsString()
  table!: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsObject()
  record?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  old_record?: Record<string, unknown> | null;
}
