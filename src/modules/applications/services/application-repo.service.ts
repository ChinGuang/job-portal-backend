import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TypeormErrorCode } from '../../../common/constants/database';
import { Job, JobStatus } from '../../jobs/entities/job.entity';
import { JobSeekerProfile } from '../../profiles/entities/profile.entity';
import { CreateApplicationDto } from '../dto/create-application.dto';
import { ListMyApplicationsQueryDto } from '../dto/list-my-applications-query.dto';
import { Application, ApplicationStatus } from '../entities/application.entity';

const ALREADY_APPLIED = 'You have already applied to this job listing.';

const NO_RESUME =
  'You need a résumé to apply. Upload one at POST /profiles/job-seeker/resume, ' +
  'or name one on this request with `resumeUrl`.';

const FOREIGN_RESUME =
  '`resumeUrl` must be a résumé belonging to your own job seeker profile.';

/**
 * Whether a résumé key belongs to the profile applying with it.
 *
 * Résumés live under a per-profile prefix in a private bucket, and the key is
 * stored as a snapshot that an employer later exchanges for a signed URL. Left
 * unchecked, `resumeUrl` would therefore be a way to attach *someone else's*
 * private file to your own application, so a supplied key has to be one of the
 * caller's own.
 */
function isOwnResume(resumeUrl: string, profile: JobSeekerProfile): boolean {
  return resumeUrl.startsWith(`${profile.id}/`);
}

@Injectable()
export class ApplicationRepoService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  /**
   * The listing a seeker may apply to, or the reason they may not.
   *
   * The two refusals are deliberately different. A DRAFT or ARCHIVED listing
   * is a 404, exactly as the public read path treats it: to someone with no
   * claim on it, an unpublished listing does not exist, and saying otherwise
   * would confirm that a guessed id is real. A CLOSED one is a 409 — it is
   * publicly readable, so its existence is not a secret; what stops the
   * application is the state the listing has moved into.
   */
  private async findApplicableJob(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (
      !job ||
      job.status === JobStatus.DRAFT ||
      job.status === JobStatus.ARCHIVED
    ) {
      throw new NotFoundException('Job listing not found.');
    }
    if (job.status !== JobStatus.PUBLISHED) {
      throw new ConflictException(
        'This job listing is no longer accepting applications.',
      );
    }
    return job;
  }

  /**
   * The résumé this application is recorded against: the one named on the
   * request, falling back to whatever is on the profile today.
   *
   * The result is a snapshot of a key, not a copy of a file. Applying with no
   * résumé on either is refused rather than allowed through empty — an
   * application an employer cannot read is not an application.
   */
  private resolveResumeUrl(
    profile: JobSeekerProfile,
    supplied: string | undefined,
  ): string {
    if (supplied) {
      if (!isOwnResume(supplied, profile)) {
        throw new BadRequestException(FOREIGN_RESUME);
      }
      return supplied;
    }
    if (!profile.resumeUrl) {
      throw new BadRequestException(NO_RESUME);
    }
    return profile.resumeUrl;
  }

  async create(
    jobId: string,
    profile: JobSeekerProfile,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    await this.findApplicableJob(jobId);
    const resumeUrl = this.resolveResumeUrl(profile, dto.resumeUrl);

    const application = this.applicationRepository.create({
      jobId,
      jobSeekerProfileId: profile.id,
      coverLetter: dto.coverLetter ?? null,
      resumeUrl,
      status: ApplicationStatus.SUBMITTED,
    });

    try {
      return await this.applicationRepository.save(application);
    } catch (error) {
      // The unique constraint on (job, seeker) is what actually enforces "one
      // application per listing" — a read-then-write pre-check cannot, since
      // two concurrent requests both pass it — so the 409 is produced from the
      // violation itself rather than from a check that races.
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

  /**
   * One page of the seeker's own applications, newest first. `total` counts
   * every application they have submitted, not just the page.
   */
  async findAllByJobSeeker(
    jobSeekerProfileId: string,
    { limit, offset }: ListMyApplicationsQueryDto,
  ): Promise<{ items: Application[]; total: number }> {
    // id breaks ties on createdAt, so paging cannot show or skip an
    // application just because two were submitted in the same instant.
    const [items, total] = await this.applicationRepository.findAndCount({
      where: { jobSeekerProfileId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  /**
   * One of the seeker's own applications, with the listing it was for.
   *
   * Another seeker's application is a 404, not the 403 the listing endpoints
   * return for another company's job. The difference is what the status code
   * would give away: a listing is a public artifact whose existence is already
   * known, whereas an application is private to the two parties in it, and a
   * 403 would confirm to a stranger that a given person applied somewhere.
   */
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
}
