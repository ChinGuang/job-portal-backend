import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JobBrowseLimit, JobLimit } from '../../../common/constants/job';
import { JobType } from '../entities/job.entity';
import { JobPagingQueryDto } from './job-paging-query.dto';

/**
 * Trims what a visitor typed, so a stray space around a search term is not
 * the difference between a hit and an empty page. A term that was nothing but
 * whitespace becomes `undefined` rather than `''` — an empty filter is the
 * absence of a filter, and saying so here keeps the query builder from having
 * to distinguish the two.
 */
const TrimToUndefined = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

export class BrowseJobsQueryDto extends JobPagingQueryDto {
  @ApiPropertyOptional({
    enum: JobType,
    description: 'Return only listings of this working arrangement.',
  })
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiPropertyOptional({
    example: 'Kuala Lumpur',
    description:
      'Case-insensitive substring of the listing location, so that ' +
      '"Malaysia" also finds "Kuala Lumpur, Malaysia".',
  })
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(JobLimit.LOCATION_MAX_LENGTH)
  location?: string;

  @ApiPropertyOptional({
    example: 'rust',
    description:
      'Case-insensitive substring of the listing title or description.',
  })
  @IsOptional()
  @TrimToUndefined()
  @IsString()
  @MaxLength(JobBrowseLimit.KEYWORD_MAX_LENGTH)
  keyword?: string;
}
