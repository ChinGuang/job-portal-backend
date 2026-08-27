import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ListPaging } from '../constants/paging';

/**
 * Offset/limit paging, shared by every listing feed in the API.
 *
 * The employer's own listings, the public job board and a seeker's own
 * applications all page the same way, so the rules live in one place: a second
 * copy is how two feeds start disagreeing about what `limit=0` means.
 */
export class PagingQueryDto {
  @ApiPropertyOptional({
    default: ListPaging.DEFAULT_LIMIT,
    maximum: ListPaging.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ListPaging.MAX_LIMIT)
  limit: number = ListPaging.DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
