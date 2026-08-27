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

  // The snapshot exactly as it was stored: a private-bucket object key, not a
  // URL anyone can fetch. It is handed back unsigned on purpose — exchanging a
  // key for a short-lived signed URL is the résumé-access endpoint's job, and
  // signing here would cost one round trip per row on the list feed.
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
