import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../entities/application.entity';

export class UpdateApplicationStatusDto {
  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.REVIEWED,
    description:
      'The status to move the application to. `SUBMITTED` → `REVIEWED` → ' +
      '`OFFERED` | `REJECTED` are the supported moves; `OFFERED` and ' +
      '`REJECTED` are final.',
  })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
