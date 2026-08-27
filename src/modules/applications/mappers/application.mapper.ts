import { plainToInstance } from 'class-transformer';
import { Application } from '../entities/application.entity';
import { ApplicationDetailResponseDto } from '../dto/application-detail-response.dto';
import { ApplicationResponseDto } from '../dto/application-response.dto';

/**
 * Entity to wire shape, in one place because both controllers answer with the
 * same application and a second copy is how two endpoints start describing one
 * record differently.
 *
 * `excludeExtraneousValues` is the point: it means a column added to the
 * entity later — an internal note, an employer-only field — does not silently
 * appear in a seeker's response just by existing.
 */
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
