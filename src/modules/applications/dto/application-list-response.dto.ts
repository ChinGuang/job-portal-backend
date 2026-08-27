import { ApiProperty } from '@nestjs/swagger';
import { ApplicationResponseDto } from './application-response.dto';

export class ApplicationListResponseDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  items!: ApplicationResponseDto[];

  @ApiProperty({ example: 3 })
  total!: number;
}
