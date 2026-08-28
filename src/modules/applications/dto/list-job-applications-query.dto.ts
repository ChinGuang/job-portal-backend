import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PagingQueryDto } from '../../../common/dto/paging-query.dto';
import { ApplicationStatus } from '../entities/application.entity';

export class ListJobApplicationsQueryDto extends PagingQueryDto {
  @ApiPropertyOptional({
    enum: ApplicationStatus,
    description:
      'Narrows the page to one status. Omit it to see every application on ' +
      'the listing.',
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
