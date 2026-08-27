import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { JobResponseDto } from '../../jobs/dto/job-response.dto';
import { ApplicationResponseDto } from './application-response.dto';

/**
 * One application as its own seeker opens it: the application plus the listing
 * it was for.
 *
 * The listing travels with the application rather than behind a second
 * request, because the question this endpoint answers — "what did I apply to?"
 * — is unanswerable without it.
 *
 * The listing is carried in its full form, current status included, rather
 * than the public one: a seeker holding an application deserves to see that
 * the role has since been closed or archived, which the public read path would
 * hide behind a 404.
 */
export class ApplicationDetailResponseDto extends ApplicationResponseDto {
  @ApiProperty({ type: JobResponseDto })
  @Expose()
  @Type(() => JobResponseDto)
  job!: JobResponseDto;
}
