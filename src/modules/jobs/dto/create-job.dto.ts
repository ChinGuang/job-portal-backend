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
import { JobLimit } from '../../../common/constants/job';
import { JobType } from '../entities/job.entity';

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @MinLength(1)
  @MaxLength(JobLimit.TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ example: 'Own the API that powers the portal.' })
  @IsString()
  @MinLength(1)
  @MaxLength(JobLimit.DESCRIPTION_MAX_LENGTH)
  description!: string;

  @ApiProperty({
    type: [String],
    example: ['TypeScript', '5 years of backend experience'],
    description: 'Required, but may be empty.',
  })
  @IsArray()
  @ArrayMaxSize(JobLimit.REQUIREMENTS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(JobLimit.REQUIREMENT_MAX_LENGTH, { each: true })
  requirements!: string[];

  @ApiProperty({ example: 'Kuala Lumpur' })
  @IsString()
  @MinLength(1)
  @MaxLength(JobLimit.LOCATION_MAX_LENGTH)
  location!: string;

  @ApiProperty({ enum: JobType, example: JobType.FULL_TIME })
  @IsEnum(JobType)
  jobType!: JobType;

  @ApiPropertyOptional({ example: 8000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(JobLimit.MAX_SALARY)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(JobLimit.MAX_SALARY)
  salaryMax?: number;

  @ApiPropertyOptional({ example: 'MYR', description: 'ISO 4217 code.' })
  @IsOptional()
  @IsString()
  @Length(JobLimit.CURRENCY_CODE_LENGTH, JobLimit.CURRENCY_CODE_LENGTH)
  currency?: string;
}
