import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ApplicationStatus } from '../entities/application.entity';

export class ApplicationResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  jobId!: string;

  @ApiProperty()
  @Expose()
  jobSeekerProfileId!: string;

  @ApiPropertyOptional()
  @Expose()
  coverLetter?: string | null;

  // Unsigned on purpose: signing is the résumé-access endpoint's job, and
  // doing it here would cost a round trip per row on the list feed.
  @ApiProperty({
    description:
      'The résumé attached to this application, as a storage key. Not ' +
      'directly fetchable.',
  })
  @Expose()
  resumeUrl!: string;

  @ApiProperty({ enum: ApplicationStatus })
  @Expose()
  status!: ApplicationStatus;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
