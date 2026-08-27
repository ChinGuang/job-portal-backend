import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { Job, JobStatus } from '../entities/job.entity';

@Injectable()
export class JobRepoService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  async create(employerProfileId: string, dto: CreateJobDto): Promise<Job> {
    const job = this.jobRepository.create({
      ...dto,
      requirements: dto.requirements ?? [],
      employerProfileId,
      status: JobStatus.DRAFT,
    });
    return this.jobRepository.save(job);
  }

  /**
   * Loads a listing and proves the given employer owns it. A listing that
   * exists but belongs to another company is a 403, not a 404 — the caller is
   * authenticated and the resource is real, they simply have no claim on it.
   */
  async findOwned(id: string, employerProfileId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job listing not found.');
    }
    if (job.employerProfileId !== employerProfileId) {
      throw new ForbiddenException(
        'This job listing belongs to another company.',
      );
    }
    return job;
  }

  async update(
    id: string,
    employerProfileId: string,
    dto: UpdateJobDto,
  ): Promise<Job> {
    const job = await this.findOwned(id, employerProfileId);
    Object.assign(job, dto);
    return this.jobRepository.save(job);
  }

  /** Every listing the employer owns, in every status, newest first. */
  async findAllByEmployer(
    employerProfileId: string,
  ): Promise<{ items: Job[]; total: number }> {
    const [items, total] = await this.jobRepository.findAndCount({
      where: { employerProfileId },
      order: { createdAt: 'DESC' },
    });
    return { items, total };
  }
}
