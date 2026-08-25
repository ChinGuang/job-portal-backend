import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobSeekerProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  headline?: string | null;

  @ApiPropertyOptional()
  bio?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty({ type: [String] })
  skills!: string[];

  @ApiPropertyOptional()
  yearsOfExperience?: number | null;

  @ApiPropertyOptional()
  resumeUrl?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  constructor(partial: Partial<JobSeekerProfileResponseDto>) {
    Object.assign(this, partial);
  }
}
