import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  RESUME_SIGNED_URL_TTL_SECONDS,
  isOwnResumeKey,
} from '../../profiles/modules/job-seeker-profile/domain/resume-key';
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

const SELF_DECISION =
  'You cannot decide your own application, even on your own listing.';

const DECIDED_CONCURRENTLY =
  'This application was decided by someone else while you were deciding it. ' +
  'Reload it and look at where it stands now.';

export interface DecidingEmployer {
  employerProfileId: string;
  userId: string;
}

@Injectable()
export class ApplicationRepoService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
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

  async findAllForJobOwner(
    jobId: string,
    employerProfileId: string,
    { status, limit, offset }: ListJobApplicationsQueryDto,
  ): Promise<{ items: Application[]; total: number }> {
    // Check the job listing is belong to employer, forbidden to non-owner
    await this.jobRepoService.findOwned(jobId, employerProfileId);

    const [items, total] = await this.applicationRepository.findAndCount({
      where: status ? { jobId, status } : { jobId },
      relations: { jobSeekerProfile: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  private async findOwnedByJobOwner(
    id: string,
    employerProfileId: string,
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { job: true, jobSeekerProfile: true },
    });
    if (
      !application ||
      application.job?.employerProfileId !== employerProfileId
    ) {
      throw new NotFoundException('Application not found.');
    }
    return application;
  }

  async getResumeSignedUrlForJobOwner(
    id: string,
    employerProfileId: string,
  ): Promise<string> {
    const application = await this.findOwnedByJobOwner(id, employerProfileId);
    return this.storageService.createSignedUrl(
      application.resumeUrl,
      RESUME_SIGNED_URL_TTL_SECONDS,
    );
  }

  async changeStatus(
    id: string,
    decider: DecidingEmployer,
    status: ApplicationStatus,
  ): Promise<Application> {
    const application = await this.findOwnedByJobOwner(
      id,
      decider.employerProfileId,
    );

    if (application.jobSeekerProfile?.userId === decider.userId) {
      throw new ForbiddenException(SELF_DECISION);
    }

    if (!canTransition(application.status, status)) {
      throw new ConflictException(
        isTerminal(application.status)
          ? `A ${application.status} application is a final decision and cannot be moved to ${status}.`
          : `A ${application.status} application cannot be moved to ${status}.`,
      );
    }

    const { affected } = await this.applicationRepository.update(
      { id, status: application.status },
      { status },
    );
    if (!affected) {
      throw new ConflictException(DECIDED_CONCURRENTLY);
    }

    return this.findOwnedByJobOwner(id, decider.employerProfileId);
  }
}
