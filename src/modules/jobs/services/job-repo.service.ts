import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { canTransition } from '../domain/job-status';
import { CreateJobDto } from '../dto/create-job.dto';
import { ListMyJobsQueryDto } from '../dto/list-my-jobs-query.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { Job, JobStatus } from '../entities/job.entity';

@Injectable()
export class JobRepoService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  /**
   * A salary range exists so a candidate can self-select, which an inverted
   * one defeats. Checked on the merged listing rather than in the DTO,
   * because a PATCH may move one bound against the other's stored value.
   */
  private assertSalaryRangeIsCoherent(job: Job): void {
    const { salaryMin, salaryMax } = job;
    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      throw new BadRequestException(
        'salaryMin must not be greater than salaryMax.',
      );
    }
  }

  async create(employerProfileId: string, dto: CreateJobDto): Promise<Job> {
    const job = this.jobRepository.create({
      ...dto,
      employerProfileId,
      status: JobStatus.DRAFT,
    });
    this.assertSalaryRangeIsCoherent(job);
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
    this.assertSalaryRangeIsCoherent(job);
    return this.jobRepository.save(job);
  }

  /**
   * Moves one of the employer's listings along its lifecycle.
   *
   * An unreachable move is a 409, not a 400: the body is well-formed and the
   * status is a real one — it is the listing's current state that makes the
   * request impossible, and that state may well have changed under the caller.
   */
  async changeStatus(
    id: string,
    employerProfileId: string,
    status: JobStatus,
  ): Promise<Job> {
    const job = await this.findOwned(id, employerProfileId);
    if (!canTransition(job.status, status)) {
      throw new ConflictException(
        `A ${job.status} listing cannot be moved to ${status}.`,
      );
    }
    job.status = status;
    return this.jobRepository.save(job);
  }

  /**
   * Deletes a listing the soft way: it becomes ARCHIVED and the row stays,
   * so applications made against it keep pointing at something real.
   *
   * Archiving an archived listing succeeds without a second write. A delete
   * that has already happened is not an error to report, it is the state the
   * caller asked for.
   */
  async archive(id: string, employerProfileId: string): Promise<Job> {
    const job = await this.findOwned(id, employerProfileId);
    if (job.status === JobStatus.ARCHIVED) {
      return job;
    }
    job.status = JobStatus.ARCHIVED;
    return this.jobRepository.save(job);
  }

  /**
   * One page of the employer's listings, in every status, newest first.
   * `total` counts every listing they own, not just the page.
   */
  async findAllByEmployer(
    employerProfileId: string,
    { limit, offset }: ListMyJobsQueryDto,
  ): Promise<{ items: Job[]; total: number }> {
    const [items, total] = await this.jobRepository.findAndCount({
      where: { employerProfileId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }
}
