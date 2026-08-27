import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  PUBLICLY_VISIBLE_STATUSES,
  canTransition,
  isTerminal,
} from '../domain/job-status';
import { BrowseJobsQueryDto } from '../dto/browse-jobs-query.dto';
import { CreateJobDto } from '../dto/create-job.dto';
import { ListMyJobsQueryDto } from '../dto/list-my-jobs-query.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { Job, JobStatus } from '../entities/job.entity';

/**
 * Turns a visitor's words into a case-insensitive "contains" pattern.
 *
 * The escaping is the point. `%` and `_` are wildcards to LIKE, so a visitor
 * searching for "100%" would otherwise match every listing, and one searching
 * "a_b" would match "axb". Escaping them — and the escape character itself,
 * first, so it cannot double-escape what follows — makes the search mean what
 * was typed. This is a matching concern, not an injection one: the pattern is
 * still bound as a parameter.
 */
function containsPattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, '\\$&');
  return `%${escaped}%`;
}

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
    // An archived listing is a record of something that happened. Editing it
    // would rewrite that record, so the content endpoint stops here too.
    if (isTerminal(job.status)) {
      throw new ConflictException(
        'An ARCHIVED listing can no longer be edited.',
      );
    }
    Object.assign(job, dto);
    this.assertSalaryRangeIsCoherent(job);
    return this.jobRepository.save(job);
  }

  /**
   * Moves one of the employer's listings along its lifecycle.
   *
   * An unreachable move is a 409, not a 400: the body is well-formed and the
   * status is a real one — what makes the request impossible is the state the
   * listing is in, not the request itself.
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
    if (isTerminal(job.status)) {
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

  /**
   * Narrows a query to what a visitor asked for. Every clause is additive, so
   * an absent filter is simply a clause that was never added — which is why
   * the DTO turns a blank filter into `undefined` before it gets here.
   */
  private applyBrowseFilters(
    builder: SelectQueryBuilder<Job>,
    { jobType, location, keyword }: BrowseJobsQueryDto,
  ): void {
    if (jobType) {
      builder.andWhere('job.jobType = :jobType', { jobType });
    }
    if (location) {
      builder.andWhere('job.location ILIKE :location', {
        location: containsPattern(location),
      });
    }
    if (keyword) {
      builder.andWhere(
        '(job.title ILIKE :keyword OR job.description ILIKE :keyword)',
        { keyword: containsPattern(keyword) },
      );
    }
  }

  /**
   * One page of the public job board, newest first.
   *
   * PUBLISHED alone, not every publicly *readable* status: a CLOSED listing
   * stays reachable by its link so a candidate learns the role is gone, but
   * putting it in the browse list would offer people roles they cannot apply
   * to. `total` counts every listing matching the filters, not just the page,
   * so a client can size the pager before walking it.
   */
  async findPublished(
    query: BrowseJobsQueryDto,
  ): Promise<{ items: Job[]; total: number }> {
    const { limit, offset } = query;
    const builder = this.jobRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.PUBLISHED });
    this.applyBrowseFilters(builder, query);

    // id breaks ties on createdAt, so paging cannot show or skip a listing
    // just because two were published in the same instant.
    const [items, total] = await builder
      .orderBy('job.createdAt', 'DESC')
      .addOrderBy('job.id', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items, total };
  }

  /**
   * One listing as a visitor may read it, with the company attached.
   *
   * A DRAFT or ARCHIVED listing is a 404 rather than a 403: to someone with no
   * claim on it, an unpublished listing does not exist, and a 403 would confirm
   * that an id is real — which is exactly what a draft is meant not to reveal.
   */
  async findPubliclyVisible(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id, status: In([...PUBLICLY_VISIBLE_STATUSES]) },
      relations: { employerProfile: true },
    });
    if (!job) {
      throw new NotFoundException('Job listing not found.');
    }
    return job;
  }
}
