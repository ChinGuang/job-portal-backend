import { plainToInstance } from 'class-transformer';
import { ApplicationDetailResponseDto } from '../dto/application-detail-response.dto';
import { ApplicationResponseDto } from '../dto/application-response.dto';
import { Application } from '../entities/application.entity';

// `excludeExtraneousValues` keeps a column added to the entity later from
// appearing in a seeker's response just by existing.
export function toApplicationDto(
  application: Application,
): ApplicationResponseDto {
  return plainToInstance(ApplicationResponseDto, application, {
    excludeExtraneousValues: true,
  });
}

export function toApplicationDetailDto(
  application: Application,
): ApplicationDetailResponseDto {
  return plainToInstance(ApplicationDetailResponseDto, application, {
    excludeExtraneousValues: true,
  });
}
