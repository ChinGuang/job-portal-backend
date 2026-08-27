import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { JobStatus, JobType } from '../entities/job.entity';

export class JobResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  employerProfileId!: string;

  @ApiProperty()
  @Expose()
  title!: string;

  @ApiProperty()
  @Expose()
  description!: string;

  @ApiProperty({ type: [String] })
  @Expose()
  requirements!: string[];

  @ApiProperty()
  @Expose()
  location!: string;

  @ApiProperty({ enum: JobType })
  @Expose()
  jobType!: JobType;

  @ApiPropertyOptional()
  @Expose()
  salaryMin?: number | null;

  @ApiPropertyOptional()
  @Expose()
  salaryMax?: number | null;

  @ApiPropertyOptional()
  @Expose()
  currency?: string | null;

  @ApiProperty({ enum: JobStatus })
  @Expose()
  status!: JobStatus;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
