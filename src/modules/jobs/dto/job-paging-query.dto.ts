import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JobListPaging } from '../../../common/constants/job';

/**
 * Offset/limit paging, shared by every listing feed.
 *
 * Both the employer's own feed and the public one page the same way, so the
 * rules live in one place: a second copy is how two feeds start disagreeing
 * about what `limit=0` means.
 */
export class JobPagingQueryDto {
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
