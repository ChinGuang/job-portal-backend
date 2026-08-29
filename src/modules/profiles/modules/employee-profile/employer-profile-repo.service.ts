import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TypeormErrorCode } from '../../../../common/constants/database';
import type { StorageService } from '../../../storage/storage.service.interface';
import { STORAGE_SERVICE } from '../../../storage/storage.tokens';
import { EmployerProfile } from '../../entities/profile.entity';
import { buildLogoKey } from './domain/logo-key';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';

@Injectable()
export class EmployerProfileRepoService {
  private readonly logger = new Logger(EmployerProfileRepoService.name);

  constructor(
    @InjectRepository(EmployerProfile)
    private readonly employerProfileRepository: Repository<EmployerProfile>,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
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

  async uploadLogo(
    userId: string,
    file: Express.Multer.File,
  ): Promise<EmployerProfile> {
    const profile = await this.readProfile(userId);

    const path = buildLogoKey(profile.id, file.mimetype);
    const previousPath = profile.logoUrl;

    // Upload the new object and commit the DB row before touching the old
    // one — if either the upload or the save fails, the previous logo (if
    // any) is untouched and still resolvable, rather than deleted out from
    // under a profile that no longer has a working replacement.
    await this.storageService.upload(path, file.buffer, file.mimetype);
    profile.logoUrl = path;
    const saved = await this.employerProfileRepository.save(profile);

    // A previous logo under a different path (e.g. the image type changed
    // between uploads) is now orphaned by the fixed-path upsert above.
    // Best-effort cleanup: it's no longer referenced by the profile either
    // way, so a delete failure here shouldn't fail the request.
    if (previousPath && previousPath !== path) {
      try {
        await this.storageService.delete(previousPath);
      } catch (error) {
        this.logger.warn(
          `${this.uploadLogo.name}: failed to delete orphaned logo at ` +
            `"${previousPath}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return saved;
  }
}
