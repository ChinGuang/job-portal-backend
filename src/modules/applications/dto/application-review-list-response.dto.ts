import { ApiProperty } from '@nestjs/swagger';
import { ApplicationReviewResponseDto } from './application-review-response.dto';

export class ApplicationReviewListResponseDto {
  @ApiProperty({ type: [ApplicationReviewResponseDto] })
  items!: ApplicationReviewResponseDto[];

  @ApiProperty({ example: 3 })
  total!: number;
}
