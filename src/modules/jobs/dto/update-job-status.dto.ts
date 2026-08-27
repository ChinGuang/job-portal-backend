import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { JobStatus } from '../entities/job.entity';

export class UpdateJobStatusDto {
  // Every status is accepted by validation, not just the reachable ones, so
  // that asking for an unreachable move earns an explanation of the lifecycle
  // (409) rather than a bare "not a valid enum value" (400).
  @ApiProperty({
    enum: JobStatus,
    example: JobStatus.PUBLISHED,
    description:
      'The status to move the listing to. `DRAFT` → `PUBLISHED` and ' +
      '`PUBLISHED` → `CLOSED` are the supported moves; archiving is done ' +
      'with `DELETE /jobs/:id`.',
  })
  @IsEnum(JobStatus)
  status!: JobStatus;
}
