import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * The company as a stranger may see it.
 *
 * Deliberately not `EmployerProfileResponseDto`: that one answers "what does
 * this employer see of their own profile?" and carries `userId` and
 * `deletedAt` — account plumbing that says which person is behind a company
 * and whether it has been deleted. Neither is a visitor's business, and
 * reusing the owner's shape here would leak both the moment a field is added
 * to it. Two audiences, two shapes.
 */
export class PublicEmployerProfileDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  companyName!: string;

  @ApiPropertyOptional()
  @Expose()
  websiteUrl?: string | null;

  @ApiPropertyOptional()
  @Expose()
  logoUrl?: string | null;

  @ApiPropertyOptional()
  @Expose()
  industry?: string | null;

  @ApiPropertyOptional()
  @Expose()
  companySize?: string | null;

  @ApiPropertyOptional()
  @Expose()
  description?: string | null;

  @ApiPropertyOptional()
  @Expose()
  address?: string | null;
}
