import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PublicEmployerProfileDto } from '../../profiles/modules/employee-profile/dto/public-employer-profile.dto';
import { JobResponseDto } from './job-response.dto';

/**
 * One listing as a visitor opens it: the listing itself plus the company
 * behind it.
 *
 * The company travels with the listing rather than behind a second request,
 * because deciding whether to apply means weighing the role and the employer
 * together, and a detail page that needs two round trips to be useful is a
 * detail page that is missing half of itself.
 */
export class PublicJobDetailResponseDto extends JobResponseDto {
  // The entity calls this relation `employerProfile`; to a visitor it is
  // simply the employer, so the wire name says that and `@Expose({ name })`
  // bridges the two.
  @ApiProperty({ type: PublicEmployerProfileDto })
  @Expose({ name: 'employerProfile' })
  @Type(() => PublicEmployerProfileDto)
  employer!: PublicEmployerProfileDto;
}
