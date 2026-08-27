import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JobListPaging } from '../../../common/constants/job';

export class ListMyJobsQueryDto {
  @ApiPropertyOptional({
    default: JobListPaging.DEFAULT_LIMIT,
    maximum: JobListPaging.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(JobListPaging.MAX_LIMIT)
  limit: number = JobListPaging.DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
