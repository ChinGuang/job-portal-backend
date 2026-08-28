import { ApiProperty } from '@nestjs/swagger';

export class ApplicationResumeResponseDto {
  @ApiProperty({
    description: 'A short-lived signed URL to the applicant’s résumé.',
  })
  resumeUrl!: string;

  constructor(resumeUrl: string) {
    this.resumeUrl = resumeUrl;
  }
}
