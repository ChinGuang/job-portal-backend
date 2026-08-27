/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TestAuthSeam } from './helpers/auth.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

const JOBS_URL = '/jobs';
const MINE_URL = '/jobs/mine';
const EMPLOYER_PROFILE_URL = '/profiles/employer';
const UNKNOWN_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

interface JobBody {
  id: string;
  title: string;
  status: string;
}

const A_JOB = {
  title: 'Senior Backend Engineer',
  description: 'Own the API that powers the portal.',
  requirements: ['TypeScript', '5 years of backend experience'],
  location: 'Kuala Lumpur',
  jobType: 'FULL_TIME',
};

describe('Job listing lifecycle (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const authSeam = new TestAuthSeam();

  beforeAll(async () => {
    authSeam.setupKeys();
    process.env.TEST_PUBLIC_KEY = authSeam.getPublicKeyPem();
    process.env.SUPABASE_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeader = (sub: string) => `Bearer ${authSeam.mintToken(sub)}`;

  /** Gives `sub` an employer profile so the employer-capability guard passes. */
  const becomeEmployer = async (sub: string, companyName = 'Acme Inc') => {
    await request(app.getHttpServer())
      .post(EMPLOYER_PROFILE_URL)
      .set('Authorization', authHeader(sub))
      .send({ companyName })
      .expect(201);
  };

  const createJob = async (
    sub: string,
    overrides: Record<string, unknown> = {},
  ): Promise<JobBody> => {
    const res = await request(app.getHttpServer())
      .post(JOBS_URL)
      .set('Authorization', authHeader(sub))
      .send({ ...A_JOB, ...overrides })
      .expect(201);
    return res.body as JobBody;
  };

  const setStatus = (sub: string, id: string, status: string) =>
    request(app.getHttpServer())
      .patch(`${JOBS_URL}/${id}/status`)
      .set('Authorization', authHeader(sub))
      .send({ status });

  /** Reads the status straight from the database, past any read-path filter. */
  const storedStatus = async (id: string): Promise<string | undefined> => {
    const rows: { status: string }[] = await dataSource.query(
      `SELECT status FROM jobs WHERE id = $1`,
      [id],
    );
    return rows[0]?.status;
  };

  /** Walks a listing to PUBLISHED through the API, as an employer would. */
  const publishedJob = async (sub: string): Promise<JobBody> => {
    const job = await createJob(sub);
    await setStatus(sub, job.id, 'PUBLISHED').expect(200);
    return job;
  };

  describe('PATCH /jobs/:id/status', () => {
    it('publishes a draft', async () => {
      await becomeEmployer('pub-1');
      const job = await createJob('pub-1');

      const res = await setStatus('pub-1', job.id, 'PUBLISHED').expect(200);

      expect(res.body).toMatchObject({ id: job.id, status: 'PUBLISHED' });
      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('closes a published listing', async () => {
      await becomeEmployer('pub-2');
      const job = await publishedJob('pub-2');

      const res = await setStatus('pub-2', job.id, 'CLOSED').expect(200);

      expect(res.body).toMatchObject({ id: job.id, status: 'CLOSED' });
      await expect(storedStatus(job.id)).resolves.toBe('CLOSED');
    });

    it('leaves the listing content untouched', async () => {
      await becomeEmployer('pub-3');
      const job = await createJob('pub-3');

      const res = await setStatus('pub-3', job.id, 'PUBLISHED').expect(200);

      expect(res.body).toMatchObject({
        title: A_JOB.title,
        description: A_JOB.description,
        requirements: A_JOB.requirements,
        location: A_JOB.location,
      });
    });

    it('refuses to close a draft that was never published', async () => {
      await becomeEmployer('conflict-1');
      const job = await createJob('conflict-1');

      await setStatus('conflict-1', job.id, 'CLOSED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('refuses to reopen a closed listing', async () => {
      await becomeEmployer('conflict-2');
      const job = await publishedJob('conflict-2');
      await setStatus('conflict-2', job.id, 'CLOSED').expect(200);

      await setStatus('conflict-2', job.id, 'PUBLISHED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('CLOSED');
    });

    it('refuses to send a published listing back to draft', async () => {
      await becomeEmployer('conflict-3');
      const job = await publishedJob('conflict-3');

      await setStatus('conflict-3', job.id, 'DRAFT').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('refuses to archive through the status endpoint', async () => {
      // Archiving has one door, and it is DELETE.
      await becomeEmployer('conflict-4');
      const job = await publishedJob('conflict-4');

      await setStatus('conflict-4', job.id, 'ARCHIVED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('refuses to republish an already-published listing', async () => {
      await becomeEmployer('conflict-5');
      const job = await publishedJob('conflict-5');

      await setStatus('conflict-5', job.id, 'PUBLISHED').expect(409);
    });

    it('refuses any move out of ARCHIVED', async () => {
      await becomeEmployer('conflict-6');
      const job = await publishedJob('conflict-6');
      await request(app.getHttpServer())
        .delete(`${JOBS_URL}/${job.id}`)
        .set('Authorization', authHeader('conflict-6'))
        .expect(200);

      await setStatus('conflict-6', job.id, 'PUBLISHED').expect(409);
      await setStatus('conflict-6', job.id, 'CLOSED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');
    });

    it('refuses a status change to another company’s listing with 403', async () => {
      await becomeEmployer('owner-a', 'Owner Co');
      await becomeEmployer('intruder-a', 'Intruder Co');
      const job = await createJob('owner-a');

      await setStatus('intruder-a', job.id, 'PUBLISHED').expect(403);

      // The listing is untouched for its real owner.
      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('refuses a status change from a user without an employer profile', async () => {
      await becomeEmployer('owner-b');
      const job = await createJob('owner-b');

      const res = await setStatus('no-profile-1', job.id, 'PUBLISHED').expect(
        403,
      );

      expect(res.body.message).toMatch(/employer profile/i);
      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it.each([
      ['an unknown status', { status: 'PERMANENT_VACATION' }],
      ['a missing status', {}],
      ['a null status', { status: null }],
      ['an unknown field', { status: 'PUBLISHED', reason: 'because' }],
    ])('rejects %s with 400', async (_label, body) => {
      await becomeEmployer('validation-1');
      const job = await createJob('validation-1');

      await request(app.getHttpServer())
        .patch(`${JOBS_URL}/${job.id}/status`)
        .set('Authorization', authHeader('validation-1'))
        .send(body)
        .expect(400);

      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('returns 404 for a listing that does not exist', async () => {
      await becomeEmployer('missing-1');

      await setStatus('missing-1', UNKNOWN_ID, 'PUBLISHED').expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await becomeEmployer('missing-2');

      await setStatus('missing-2', 'not-a-uuid', 'PUBLISHED').expect(400);
    });

    it('rejects an unauthenticated status change with 401', async () => {
      await request(app.getHttpServer())
        .patch(`${JOBS_URL}/${UNKNOWN_ID}/status`)
        .send({ status: 'PUBLISHED' })
        .expect(401);
    });
  });

  describe('DELETE /jobs/:id', () => {
    const deleteJob = (sub: string, id: string) =>
      request(app.getHttpServer())
        .delete(`${JOBS_URL}/${id}`)
        .set('Authorization', authHeader(sub));

    it.each(['DRAFT', 'PUBLISHED', 'CLOSED'])(
      'archives a %s listing instead of removing it',
      async (from) => {
        const sub = `del-${from}`;
        await becomeEmployer(sub);
        const job = await createJob(sub);
        if (from !== 'DRAFT') {
          await setStatus(sub, job.id, 'PUBLISHED').expect(200);
        }
        if (from === 'CLOSED') {
          await setStatus(sub, job.id, 'CLOSED').expect(200);
        }

        const res = await deleteJob(sub, job.id).expect(200);

        expect(res.body).toMatchObject({ id: job.id, status: 'ARCHIVED' });
        // The row survives — that is the entire point of a soft delete.
        await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');
      },
    );

    it('keeps the archived listing in the employer’s own feed', async () => {
      await becomeEmployer('del-mine');
      const job = await createJob('del-mine');

      await deleteJob('del-mine', job.id).expect(200);

      const mine = await request(app.getHttpServer())
        .get(MINE_URL)
        .set('Authorization', authHeader('del-mine'))
        .expect(200);
      expect(mine.body.total).toBe(1);
      expect(mine.body.items[0]).toMatchObject({
        id: job.id,
        status: 'ARCHIVED',
      });
    });

    it('is idempotent — deleting twice leaves it archived', async () => {
      await becomeEmployer('del-twice');
      const job = await createJob('del-twice');

      await deleteJob('del-twice', job.id).expect(200);
      const second = await deleteJob('del-twice', job.id).expect(200);

      expect(second.body).toMatchObject({ status: 'ARCHIVED' });
      await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');
    });

    it('refuses to delete another company’s listing with 403', async () => {
      await becomeEmployer('owner-c', 'Owner Co');
      await becomeEmployer('intruder-c', 'Intruder Co');
      const job = await publishedJob('owner-c');

      await deleteJob('intruder-c', job.id).expect(403);

      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('refuses a delete from a user without an employer profile', async () => {
      await becomeEmployer('owner-d');
      const job = await createJob('owner-d');

      const res = await deleteJob('no-profile-2', job.id).expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('returns 404 for a listing that does not exist', async () => {
      await becomeEmployer('missing-3');

      await deleteJob('missing-3', UNKNOWN_ID).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await becomeEmployer('missing-4');

      await deleteJob('missing-4', 'not-a-uuid').expect(400);
    });

    it('rejects an unauthenticated delete with 401', async () => {
      await request(app.getHttpServer())
        .delete(`${JOBS_URL}/${UNKNOWN_ID}`)
        .expect(401);
    });
  });

  describe('the lifecycle end to end', () => {
    it('walks draft → published → closed → archived, keeping the row', async () => {
      await becomeEmployer('walk-1');
      const job = await createJob('walk-1');

      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
      await setStatus('walk-1', job.id, 'PUBLISHED').expect(200);
      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
      await setStatus('walk-1', job.id, 'CLOSED').expect(200);
      await expect(storedStatus(job.id)).resolves.toBe('CLOSED');
      await request(app.getHttpServer())
        .delete(`${JOBS_URL}/${job.id}`)
        .set('Authorization', authHeader('walk-1'))
        .expect(200);
      await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');

      const rows: { count: number }[] = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM jobs WHERE id = $1`,
        [job.id],
      );
      expect(rows[0].count).toBe(1);
    });
  });
});
