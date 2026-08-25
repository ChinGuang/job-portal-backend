import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class EmployerProfileResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  companyName!: string;

  @ApiPropertyOptional()
  @Expose()
  websiteUrl?: string | null;

  @ApiPropertyOptional()
  @Expose()
  logoUrl?: string | null;

  @ApiPropertyOptional()
  @Expose()
  industry?: string | null;

  @ApiPropertyOptional()
  @Expose()
  companySize?: string | null;

  @ApiPropertyOptional()
  @Expose()
  description?: string | null;

  @ApiPropertyOptional()
  @Expose()
  address?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional()
  @Expose()
  deletedAt?: Date | null;

  constructor(partial: Partial<EmployerProfileResponseDto>) {
    Object.assign(this, partial);
  }
}
