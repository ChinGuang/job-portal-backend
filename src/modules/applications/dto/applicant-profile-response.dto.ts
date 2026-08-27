import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * The applicant, as the employer reviewing their application may read them.
 *
 * Deliberately not the seeker's own profile DTO. This is the narrower view a
 * candidate consented to when they applied: who they are and what they can
 * do, and nothing that identifies the account behind the profile — `userId`
 * is absent for that reason.
 *
 * `resumeUrl` is absent too, and not by oversight: the résumé an employer is
 * entitled to is the one snapshotted on the application, which sits beside
 * this object. Echoing the profile's current résumé here would hand them a
 * second, possibly different file with no claim attached to it.
 */
export class ApplicantProfileResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional()
  @Expose()
  headline?: string | null;

  @ApiPropertyOptional()
  @Expose()
  bio?: string | null;

  @ApiPropertyOptional()
  @Expose()
  phone?: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  skills!: string[];

  @ApiPropertyOptional()
  @Expose()
  yearsOfExperience?: number | null;
}
