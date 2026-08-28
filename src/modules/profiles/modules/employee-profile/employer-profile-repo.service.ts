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
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';

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

  /**
   * The plain lookup: absence is an answer, not an error. Capability checks
   * ask this — "does this user have an employer profile at all?" — and turn a
   * null into their own message.
   */
  async findByUserId(userId: string): Promise<EmployerProfile | null> {
    return this.employerProfileRepository.findOne({ where: { userId } });
  }

  async readProfile(userId: string): Promise<EmployerProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Employer profile not found.');
    }
    return profile;
  }

  async update(
    userId: string,
    dto: UpdateEmployerProfileDto,
  ): Promise<EmployerProfile> {
    const profile = await this.readProfile(userId);
    Object.assign(profile, dto);
    return this.employerProfileRepository.save(profile);
  }
}
