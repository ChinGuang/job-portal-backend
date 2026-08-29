import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateEmployerProfileDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  // `logoUrl` is intentionally not a client-settable field: the logo is owned
  // by POST /profiles/employer/logo, which stores a private-bucket object path
  // there (resolved to a signed URL on the way out). Accepting an arbitrary
  // external URL here would mean the field sometimes holds a path and
  // sometimes a URL, breaking that signing step.

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  companySize?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
