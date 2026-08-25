import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TypeormErrorCode } from '../../../../common/constants/database';
import { EmployerProfile } from '../../entities/profile.entity';

@Injectable()
export class EmployerProfileRepoService {
  constructor(
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
  ) {}

  async create(
    payload: Omit<
      EmployerProfile,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'user'
    >,
  ): Promise<EmployerProfile> {
    try {
      const profile = this.employerProfileRepository.create(payload);
      return await this.employerProfileRepository.save(profile);
    } catch (error) {
      // Check for TypeORM query execution errors
      if (error instanceof QueryFailedError) {
        // Driver-specific error code (e.g., PostgreSQL unique constraint error '23505')
        const driverError = error.driverError;
        if (driverError.code === TypeormErrorCode.UNIQUE_CONSTRAINT_VIOLATION) {
          throw new ConflictException(
            'Employer profile already exists for this user.',
          );
        }
      }

      // Fallback for unexpected database errors
      throw new InternalServerErrorException(
        'Failed to create employer profile.',
      );
    }
  }

  async readProfile(userId: string): Promise<EmployerProfile> {
    const profile = await this.employerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Employer profile not found.');
    }
    return profile;
  }
}
