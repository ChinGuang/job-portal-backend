import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApplicantProfileResponseDto } from './applicant-profile-response.dto';
import { ApplicationResponseDto } from './application-response.dto';

/**
 * One application as the reviewing employer sees it: the submission itself —
 * cover letter and the résumé it was made with — plus who sent it. Reviewing
 * a candidate from a list of ids would otherwise cost a request per row.
 */
export class ApplicationReviewResponseDto extends ApplicationResponseDto {
  @ApiProperty({ type: ApplicantProfileResponseDto })
  @Expose()
  @Type(() => ApplicantProfileResponseDto)
  jobSeekerProfile!: ApplicantProfileResponseDto;
}
