import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { JobResponseDto } from '../../jobs/dto/job-response.dto';
import { ApplicationResponseDto } from './application-response.dto';

/**
 * The application plus the listing it was for, in its full form rather than
 * the public one: a seeker deserves to see that the role has since closed,
 * which the public read path hides behind a 404.
 */
export class ApplicationDetailResponseDto extends ApplicationResponseDto {
  @ApiProperty({ type: JobResponseDto })
  @Expose()
  @Type(() => JobResponseDto)
  job!: JobResponseDto;
}
