import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApplicantProfileResponseDto } from './applicant-profile-response.dto';
import { ApplicationResponseDto } from './application-response.dto';

export class ApplicationReviewResponseDto extends ApplicationResponseDto {
  @ApiProperty({ type: ApplicantProfileResponseDto })
  @Expose()
  @Type(() => ApplicantProfileResponseDto)
  jobSeekerProfile!: ApplicantProfileResponseDto;
}
