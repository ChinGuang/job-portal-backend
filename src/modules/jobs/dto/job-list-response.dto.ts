import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';

export class JobListResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  items!: JobResponseDto[];

  @ApiProperty({ example: 3 })
  total!: number;
}
