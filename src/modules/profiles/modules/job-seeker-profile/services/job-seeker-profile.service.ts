import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TypeormErrorCode } from '../../../../../common/constants/database';
import { JobSeekerProfile } from '../../../entities/profile.entity';
import { CreateJobSeekerProfileDto } from '../dto/create-job-seeker-profile.dto';
import { UpdateJobSeekerProfileDto } from '../dto/update-job-seeker-profile.dto';

@Injectable()
export class JobSeekerProfileService {
  constructor(
    @InjectRepository(JobSeekerProfile)
    private readonly repo: Repository<JobSeekerProfile>,
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

  async findByUserId(userId: string): Promise<JobSeekerProfile> {
    const profile = await this.repo.findOne({ where: { userId } });
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
}
