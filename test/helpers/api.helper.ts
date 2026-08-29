import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { InMemoryStorageService } from '../../src/modules/storage/services/in-memory-storage.service';
import { STORAGE_SERVICE } from '../../src/modules/storage/storage.tokens';
import { TestAuthSeam } from './auth.helper';
import { PNG_BUFFER } from './logo-fixtures';
import { PDF_BUFFER } from './resume-fixtures';

export const JOBS_URL = '/jobs';
export const MINE_URL = '/jobs/mine';
export const EMPLOYER_PROFILE_URL = '/profiles/employer';
export const EMPLOYER_LOGO_URL = '/profiles/employer/logo';
export const JOB_SEEKER_PROFILE_URL = '/profiles/job-seeker';
export const JOB_SEEKER_RESUME_URL = '/profiles/job-seeker/resume';

/** A well-formed listing body, for tests that only care about one field. */
export const A_JOB = {
  title: 'Senior Backend Engineer',
  description: 'Own the API that powers the portal.',
  requirements: ['TypeScript', '5 years of backend experience'],
  location: 'Kuala Lumpur',
  jobType: 'FULL_TIME',
};

export interface JobBody {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  location: string;
  jobType: string;
  status: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
}

export interface JobListBody {
  items: JobBody[];
  total: number;
}

export interface EmployerProfileBody {
  id: string;
  companyName: string;
}

export interface JobSeekerProfileBody {
  id: string;
  name: string;
  resumeUrl: string | null;
}

export interface ApplicationBody {
  id: string;
  jobId: string;
  jobSeekerProfileId: string;
  coverLetter: string | null;
  resumeUrl: string;
  status: string;
}

/**
 * The e2e suites' shared seam: a real Nest application over the real test
 * database, with tokens minted locally. Storage is the only faked
 * collaborator, being the only one that would otherwise leave the machine.
 */
export class ApiTestHarness {
  private app!: INestApplication;
  private dataSource!: DataSource;
  private storageService!: InMemoryStorageService;
  private readonly authSeam = new TestAuthSeam();

  /** Boots the application. Call from `beforeAll`. */
  async start(): Promise<void> {
    this.authSeam.setupKeys();
    process.env.TEST_PUBLIC_KEY = this.authSeam.getPublicKeyPem();
    process.env.SUPABASE_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_SERVICE)
      .useClass(InMemoryStorageService)
      .compile();

    this.app = moduleFixture.createNestApplication();
    await this.app.init();
    this.dataSource = moduleFixture.get<DataSource>(DataSource);
    this.storageService =
      moduleFixture.get<InMemoryStorageService>(STORAGE_SERVICE);
  }

  /** The storage fake, for asserting on what was (or was not) uploaded. */
  get storage(): InMemoryStorageService {
    return this.storageService;
  }

  /** Empties the database between tests. Call from `afterEach`. */
  async truncate(): Promise<void> {
    await this.dataSource.query('TRUNCATE TABLE users CASCADE');
  }

  /** Call from `afterAll`. */
  async stop(): Promise<void> {
    await this.app.close();
  }

  /** The server, for requests this helper does not wrap. */
  get server(): Server {
    return this.app.getHttpServer() as Server;
  }

  authHeader(sub: string): string {
    return `Bearer ${this.authSeam.mintToken(sub)}`;
  }

  /**
   * Gives `sub` an employer profile so the employer-capability guard passes.
   * `overrides` fills in the rest of the company's public details for the
   * suites that read them back.
   */
  async becomeEmployer(
    sub: string,
    companyName = 'Acme Inc',
    overrides: Record<string, unknown> = {},
  ): Promise<EmployerProfileBody> {
    const res = await request(this.server)
      .post(EMPLOYER_PROFILE_URL)
      .set('Authorization', this.authHeader(sub))
      .send({ companyName, ...overrides })
      .expect(201);
    return res.body as EmployerProfileBody;
  }

  /** A job seeker profile with no résumé yet, so the "none anywhere" case is
   * still reachable. */
  async becomeJobSeeker(
    sub: string,
    name = 'Ada Lovelace',
    overrides: Record<string, unknown> = {},
  ): Promise<JobSeekerProfileBody> {
    const res = await request(this.server)
      .post(JOB_SEEKER_PROFILE_URL)
      .set('Authorization', this.authHeader(sub))
      .send({ name, ...overrides })
      .expect(201);
    return res.body as JobSeekerProfileBody;
  }

  /** Uploads a résumé for real, returning the storage key behind the response's
   * signed URL — the value an application snapshots. */
  async uploadResume(sub: string): Promise<string> {
    await request(this.server)
      .post(JOB_SEEKER_RESUME_URL)
      .set('Authorization', this.authHeader(sub))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(201);

    const [row] = await this.query<{ resume_url: string }>(
      `SELECT p.resume_url FROM job_seeker_profiles p
         JOIN users u ON u.id = p."userId"
        WHERE u."supabaseId" = $1`,
      [sub],
    );
    return row.resume_url;
  }

  /** A job seeker profile with a résumé already on it, in one step. */
  async becomeJobSeekerWithResume(
    sub: string,
    name = 'Ada Lovelace',
    overrides: Record<string, unknown> = {},
  ): Promise<{ profile: JobSeekerProfileBody; resumeUrl: string }> {
    const profile = await this.becomeJobSeeker(sub, name, overrides);
    const resumeUrl = await this.uploadResume(sub);
    return { profile, resumeUrl };
  }

  /** Uploads a company logo for real, returning the storage key behind the
   * response's signed URL — the value stored on the employer profile. */
  async uploadLogo(sub: string): Promise<string> {
    await request(this.server)
      .post(EMPLOYER_LOGO_URL)
      .set('Authorization', this.authHeader(sub))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(201);

    const [row] = await this.query<{ logoUrl: string }>(
      `SELECT p."logoUrl" FROM employer_profiles p
         JOIN users u ON u.id = p."userId"
        WHERE u."supabaseId" = $1`,
      [sub],
    );
    return row.logoUrl;
  }

  async createJob(
    sub: string,
    overrides: Record<string, unknown> = {},
  ): Promise<JobBody> {
    const res = await request(this.server)
      .post(JOBS_URL)
      .set('Authorization', this.authHeader(sub))
      .send({ ...A_JOB, ...overrides })
      .expect(201);
    return res.body as JobBody;
  }

  /** Moves one of `sub`'s listings to `status`, as the employer would. */
  setJobStatus(sub: string, id: string, status: string): request.Test {
    return request(this.server)
      .patch(`${JOBS_URL}/${id}/status`)
      .set('Authorization', this.authHeader(sub))
      .send({ status });
  }

  /** Creates a listing and walks it to PUBLISHED through the API. */
  async publishJob(
    sub: string,
    overrides: Record<string, unknown> = {},
  ): Promise<JobBody> {
    const job = await this.createJob(sub, overrides);
    const res = await this.setJobStatus(sub, job.id, 'PUBLISHED').expect(200);
    return res.body as JobBody;
  }

  async applyToJob(
    sub: string,
    jobId: string,
    body: Record<string, unknown> = {},
  ): Promise<ApplicationBody> {
    const res = await request(this.server)
      .post(`${JOBS_URL}/${jobId}/applications`)
      .set('Authorization', this.authHeader(sub))
      .send(body)
      .expect(201);
    return res.body as ApplicationBody;
  }

  /** Runs a query against the test database, past any read-path filter. */
  query<T>(sql: string, parameters: unknown[]): Promise<T[]> {
    return this.dataSource.query(sql, parameters);
  }
}
