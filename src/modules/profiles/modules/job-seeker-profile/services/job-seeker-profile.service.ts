import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TypeormErrorCode } from '../../../../../common/constants/database';
import type { StorageService } from '../../../../storage/storage.service.interface';
import { STORAGE_SERVICE } from '../../../../storage/storage.tokens';
import { JobSeekerProfile } from '../../../entities/profile.entity';
import { CreateJobSeekerProfileDto } from '../dto/create-job-seeker-profile.dto';
import { UpdateJobSeekerProfileDto } from '../dto/update-job-seeker-profile.dto';

const RESUME_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  // Legacy .doc: ResumeFileTypeValidator normalizes the OLE container
  // (application/x-cfb) to application/msword before it reaches here.
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

@Injectable()
export class JobSeekerProfileService {
  private readonly logger = new Logger(JobSeekerProfileService.name);

  constructor(
    @InjectRepository(JobSeekerProfile)
    private readonly repo: Repository<JobSeekerProfile>,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  async create(
    userId: string,
    dto: CreateJobSeekerProfileDto,
  ): Promise<JobSeekerProfile> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Job seeker profile already exists.');
    }

    const profile = this.repo.create({
      userId,
      ...dto,
      skills: dto.skills ?? [],
    });

    try {
      return await this.repo.save(profile);
    } catch (error) {
      // The findOne check above doesn't prevent a race between two
      // concurrent creates for the same user; the DB's unique constraint on
      // userId is the real guard, so translate its violation into the same
      // 409 the pre-check produces.
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code?: string }).code ===
          TypeormErrorCode.UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException('Job seeker profile already exists.');
      }
      throw error;
    }
  }

  /**
   * The plain lookup: absence is an answer, not an error. Capability checks
   * ask this — "does this user have a job seeker profile at all?" — and turn
   * a null into their own message.
   */
  async findByUserIdOrNull(userId: string): Promise<JobSeekerProfile | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async findByUserId(userId: string): Promise<JobSeekerProfile> {
    const profile = await this.findByUserIdOrNull(userId);
    if (!profile) {
      throw new NotFoundException('Job seeker profile not found.');
    }
    return profile;
  }

  async update(
    userId: string,
    dto: UpdateJobSeekerProfileDto,
  ): Promise<JobSeekerProfile> {
    const profile = await this.findByUserId(userId);
    Object.assign(profile, dto);
    return this.repo.save(profile);
  }

  async uploadResume(
    userId: string,
    file: Express.Multer.File,
  ): Promise<JobSeekerProfile> {
    const profile = await this.findByUserId(userId);

    const extension = RESUME_EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin';
    const path = `${profile.id}/resume.${extension}`;
    const previousPath = profile.resumeUrl;

    // Upload the new object and commit the DB row before touching the old
    // one — if either the upload or the save fails, the previous résumé (if
    // any) is untouched and still resolvable, rather than deleted out from
    // under a profile that no longer has a working replacement.
    await this.storageService.upload(path, file.buffer, file.mimetype);
    profile.resumeUrl = path;
    const saved = await this.repo.save(profile);

    // A previous résumé under a different path (e.g. the file type changed
    // between uploads) is now orphaned by the fixed-path upsert above.
    // Best-effort cleanup: it's no longer referenced by the profile either
    // way, so a delete failure here shouldn't fail the request.
    if (previousPath && previousPath !== path) {
      try {
        await this.storageService.delete(previousPath);
      } catch (error) {
        this.logger.warn(
          `${this.uploadResume.name}: failed to delete orphaned résumé at ` +
            `"${previousPath}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return saved;
  }
}
