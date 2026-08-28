import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ApplicantProfileResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional()
  @Expose()
  headline?: string | null;

  @ApiPropertyOptional()
  @Expose()
  bio?: string | null;

  @ApiPropertyOptional()
  @Expose()
  phone?: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  skills!: string[];

  @ApiPropertyOptional()
  @Expose()
  yearsOfExperience?: number | null;
}
