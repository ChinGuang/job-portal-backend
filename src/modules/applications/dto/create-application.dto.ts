import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApplicationLimit } from '../../../common/constants/application';

export class CreateApplicationDto {
  @ApiPropertyOptional({
    example: 'I have shipped three APIs of this shape and would love to help.',
    description: 'Optional. Omit it to apply on the résumé alone.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(ApplicationLimit.COVER_LETTER_MAX_LENGTH)
  coverLetter?: string;

  @ApiPropertyOptional({
    description:
      'Optional. The résumé to attach to this one application, as the storage ' +
      "key of a résumé belonging to the caller's own job seeker profile. " +
      "Omit it and the profile's current résumé is used instead; if there is " +
      'no résumé either way, the application is refused.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(ApplicationLimit.RESUME_URL_MAX_LENGTH)
  resumeUrl?: string;
}
