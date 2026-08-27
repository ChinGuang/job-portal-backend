import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TypeormErrorCode } from '../../../common/constants/database';
import {
  acceptsApplications,
  isPubliclyVisible,
} from '../../jobs/domain/job-status';
import { Job } from '../../jobs/entities/job.entity';
import { JobRepoService } from '../../jobs/services/job-repo.service';
import { JobSeekerProfile } from '../../profiles/entities/profile.entity';
import { isOwnResumeKey } from '../../profiles/modules/job-seeker-profile/domain/resume-key';
import type { StorageService } from '../../storage/storage.service.interface';
import { STORAGE_SERVICE } from '../../storage/storage.tokens';
import { canTransition, isTerminal } from '../domain/application-status';
import { CreateApplicationDto } from '../dto/create-application.dto';
import { ListJobApplicationsQueryDto } from '../dto/list-job-applications-query.dto';
import { ListMyApplicationsQueryDto } from '../dto/list-my-applications-query.dto';
import { Application, ApplicationStatus } from '../entities/application.entity';

const ALREADY_APPLIED = 'You have already applied to this job listing.';

const NO_RESUME =
  'You need a résumé to apply. Upload one at POST /profiles/job-seeker/resume, ' +
  'or name one on this request with `resumeUrl`.';

const FOREIGN_RESUME =
  '`resumeUrl` must be a résumé belonging to your own job seeker profile.';

const MISSING_RESUME =
  'The résumé named by `resumeUrl` has not been uploaded. Upload it at ' +
  'POST /profiles/job-seeker/resume before applying with it.';

@Injectable()
export class ApplicationRepoService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    // "Does this employer own this listing?" is a jobs question with an
    // answer — and an HTTP status — already settled there. Asking it a second
    // way here is how two modules start disagreeing about who owns what.
    private readonly jobRepoService: JobRepoService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  // 404 for a listing a visitor cannot see, so an id cannot be probed; 409 for
  // CLOSED, which is readable but no longer taking applications.
  private async findApplicableJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job || !isPubliclyVisible(job.status)) {
      throw new NotFoundException('Job listing not found.');
    }
    if (!acceptsApplications(job.status)) {
      throw new ConflictException(
        'This job listing is no longer accepting applications.',
      );
    }
    return job;
  }

  /** The key snapshotted at apply time: the one named, else the profile's. */
  private async resolveResumeUrl(
    profile: JobSeekerProfile,
    supplied: string | undefined,
  ): Promise<string> {
    if (!supplied) {
      if (!profile.resumeUrl) {
        throw new BadRequestException(NO_RESUME);
      }
      return profile.resumeUrl;
    }

    // Ownership stops a seeker naming another's private object; existence
    // stops anyone inventing a key to dodge the no-résumé refusal.
    if (!isOwnResumeKey(supplied, profile.id)) {
      throw new BadRequestException(FOREIGN_RESUME);
    }
    if (!(await this.storageService.exists(supplied))) {
      throw new BadRequestException(MISSING_RESUME);
    }
    return supplied;
  }

  async create(
    jobId: string,
    profile: JobSeekerProfile,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    await this.findApplicableJob(jobId);
    const resumeUrl = await this.resolveResumeUrl(profile, dto.resumeUrl);

    const application = this.applicationRepository.create({
      jobId,
      jobSeekerProfileId: profile.id,
      coverLetter: dto.coverLetter?.trim() || null,
      resumeUrl,
      status: ApplicationStatus.SUBMITTED,
    });

    try {
      return await this.applicationRepository.save(application);
    } catch (error) {
      // From the constraint, not a pre-check: two concurrent applies would
      // both pass a read-then-write check.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code ===
          TypeormErrorCode.UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(ALREADY_APPLIED);
      }
      throw error;
    }
  }

  /** One page, newest first; `total` counts all of them, not just the page. */
  async findAllByJobSeeker(
    jobSeekerProfileId: string,
    { limit, offset }: ListMyApplicationsQueryDto,
  ): Promise<{ items: Application[]; total: number }> {
    // id breaks createdAt ties so paging cannot skip or repeat a row.
    const [items, total] = await this.applicationRepository.findAndCount({
      where: { jobSeekerProfileId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  // 404 rather than the listings' 403: a 403 would confirm to a stranger that
  // a given person applied somewhere.
  async findOwnedByJobSeeker(
    id: string,
    jobSeekerProfileId: string,
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id, jobSeekerProfileId },
      relations: { job: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    return application;
  }

  /**
   * One page of the applications sent to a listing the employer owns, newest
   * first, each with the candidate attached so a reviewer can read the pile
   * without a request per row.
   *
   * Ownership is proved before anything is read, so an employer pointing at
   * another company's listing learns nothing about who applied to it. That
   * check is the listings' one, which means its 403 — the resource being
   * addressed here is the listing, and the caller has no claim on it.
   */
  async findAllForJobOwner(
    jobId: string,
    employerProfileId: string,
    { status, limit, offset }: ListJobApplicationsQueryDto,
  ): Promise<{ items: Application[]; total: number }> {
    await this.jobRepoService.findOwned(jobId, employerProfileId);

    // id breaks createdAt ties so paging cannot skip or repeat a row.
    const [items, total] = await this.applicationRepository.findAndCount({
      where: status ? { jobId, status } : { jobId },
      relations: { jobSeekerProfile: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  /**
   * Loads an application and proves the given employer owns the listing it
   * was sent to.
   *
   * 404 for both "no such application" and "someone else's", where the
   * listings' own ownership check would say 403. The difference is what a 403
   * would admit: that this id names a real application, and so that some
   * candidate applied somewhere. Compartmentalising candidate data means not
   * confirming that to a stranger, which is the same reason a seeker reading
   * another seeker's application gets a 404.
   */
  private async findOwnedByJobOwner(
    id: string,
    employerProfileId: string,
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { job: true },
    });
    if (
      !application ||
      application.job?.employerProfileId !== employerProfileId
    ) {
      throw new NotFoundException('Application not found.');
    }
    return application;
  }

  /**
   * Moves one application along the hiring conversation.
   *
   * An unreachable move is a 409, not a 400: the body is well-formed and the
   * status is a real one — what makes the request impossible is where the
   * application already stands, not the request itself.
   */
  async changeStatus(
    id: string,
    employerProfileId: string,
    status: ApplicationStatus,
  ): Promise<Application> {
    const application = await this.findOwnedByJobOwner(id, employerProfileId);

    if (!canTransition(application.status, status)) {
      throw new ConflictException(
        isTerminal(application.status)
          ? `A ${application.status} application is a final decision and cannot be moved to ${status}.`
          : `A ${application.status} application cannot be moved to ${status}.`,
      );
    }

    application.status = status;
    return this.applicationRepository.save(application);
  }
}
