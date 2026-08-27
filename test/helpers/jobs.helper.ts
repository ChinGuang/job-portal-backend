import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TestAuthSeam } from './auth.helper';

export const JOBS_URL = '/jobs';
export const MINE_URL = '/jobs/mine';
export const EMPLOYER_PROFILE_URL = '/profiles/employer';

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

/**
 * The job suites' shared seam: a real Nest application over the real test
 * database, with tokens minted locally. Every job spec boots the same way, so
 * the bootstrap and the "act as this employer" shorthands live here rather
 * than being copied into each one.
 */
export class JobTestHarness {
  private app!: INestApplication;
  private dataSource!: DataSource;
  private readonly authSeam = new TestAuthSeam();

  /** Boots the application. Call from `beforeAll`. */
  async start(): Promise<void> {
    this.authSeam.setupKeys();
    process.env.TEST_PUBLIC_KEY = this.authSeam.getPublicKeyPem();
    process.env.SUPABASE_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    await this.app.init();
    this.dataSource = moduleFixture.get<DataSource>(DataSource);
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
  setJobStatus(sub: string, id: string, status: string) {
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

  /** Runs a query against the test database, past any read-path filter. */
  query<T>(sql: string, parameters: unknown[]): Promise<T[]> {
    return this.dataSource.query(sql, parameters);
  }
}
