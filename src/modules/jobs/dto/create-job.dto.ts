import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JobType } from '../entities/job.entity';

// Kept generous rather than precise: the range only exists so a candidate can
// self-select, and the API has no opinion on a currency's magnitude.
const MAX_SALARY = 1_000_000_000;

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Own the API that powers the portal.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['TypeScript', '5 years of backend experience'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  requirements?: string[];

  @ApiProperty({ example: 'Kuala Lumpur' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  location!: string;

  @ApiProperty({ enum: JobType, example: JobType.FULL_TIME })
  @IsEnum(JobType)
  jobType!: JobType;

  @ApiPropertyOptional({ example: 8000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  salaryMax?: number;

  @ApiPropertyOptional({ example: 'MYR', description: 'ISO 4217 code.' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
