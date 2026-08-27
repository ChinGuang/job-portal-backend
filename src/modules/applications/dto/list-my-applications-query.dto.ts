import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApplicationListPaging } from '../../../common/constants/application';

/**
 * The seeker's own application feed takes paging and nothing else. Filtering
 * by status is the employer's need — they triage a listing's pile — whereas a
 * seeker tracking their search wants the whole of it.
 */
export class ListMyApplicationsQueryDto {
  @ApiPropertyOptional({
    default: ApplicationListPaging.DEFAULT_LIMIT,
    maximum: ApplicationListPaging.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ApplicationListPaging.MAX_LIMIT)
  limit: number = ApplicationListPaging.DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
