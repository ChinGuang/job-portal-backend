/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import {
  A_JOB,
  JOBS_URL,
  JobBody,
  JobTestHarness,
  MINE_URL,
} from './helpers/jobs.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

const UNKNOWN_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('Job listing lifecycle (e2e)', () => {
  const harness = new JobTestHarness();

  beforeAll(async () => {
    await harness.start();
  });

  afterEach(async () => {
    await harness.truncate();
  });

  afterAll(async () => {
    await harness.stop();
  });

  const setStatus = (sub: string, id: string, status: string) =>
    request(harness.server)
      .patch(`${JOBS_URL}/${id}/status`)
      .set('Authorization', harness.authHeader(sub))
      .send({ status });

  const deleteJob = (sub: string, id: string) =>
    request(harness.server)
      .delete(`${JOBS_URL}/${id}`)
      .set('Authorization', harness.authHeader(sub));

  /** Reads the status straight from the database, past any read-path filter. */
  const storedStatus = async (id: string): Promise<string | undefined> => {
    const rows = await harness.query<{ status: string }>(
      `SELECT status FROM jobs WHERE id = $1`,
      [id],
    );
    return rows[0]?.status;
  };

  /** Walks a listing to PUBLISHED through the API, as an employer would. */
  const publishedJob = async (sub: string): Promise<JobBody> => {
    const job = await harness.createJob(sub);
    await setStatus(sub, job.id, 'PUBLISHED').expect(200);
    return job;
  };

  describe('PATCH /jobs/:id/status', () => {
    it('publishes a draft', async () => {
      await harness.becomeEmployer('pub-1');
      const job = await harness.createJob('pub-1');

      const res = await setStatus('pub-1', job.id, 'PUBLISHED').expect(200);

      expect(res.body).toMatchObject({ id: job.id, status: 'PUBLISHED' });
      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('closes a published listing', async () => {
      await harness.becomeEmployer('pub-2');
      const job = await publishedJob('pub-2');

      const res = await setStatus('pub-2', job.id, 'CLOSED').expect(200);

      expect(res.body).toMatchObject({ id: job.id, status: 'CLOSED' });
      await expect(storedStatus(job.id)).resolves.toBe('CLOSED');
    });

    it('leaves the listing content untouched', async () => {
      await harness.becomeEmployer('pub-3');
      const job = await harness.createJob('pub-3');

      const res = await setStatus('pub-3', job.id, 'PUBLISHED').expect(200);

      expect(res.body).toMatchObject({
        title: A_JOB.title,
        description: A_JOB.description,
        requirements: A_JOB.requirements,
        location: A_JOB.location,
      });
    });

    it('refuses to close a draft that was never published', async () => {
      await harness.becomeEmployer('conflict-1');
      const job = await harness.createJob('conflict-1');

      await setStatus('conflict-1', job.id, 'CLOSED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('refuses to reopen a closed listing', async () => {
      await harness.becomeEmployer('conflict-2');
      const job = await publishedJob('conflict-2');
      await setStatus('conflict-2', job.id, 'CLOSED').expect(200);

      await setStatus('conflict-2', job.id, 'PUBLISHED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('CLOSED');
    });

    it('refuses to send a published listing back to draft', async () => {
      await harness.becomeEmployer('conflict-3');
      const job = await publishedJob('conflict-3');

      await setStatus('conflict-3', job.id, 'DRAFT').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('refuses to archive through the status endpoint', async () => {
      // Archiving has one door, and it is DELETE.
      await harness.becomeEmployer('conflict-4');
      const job = await publishedJob('conflict-4');

      await setStatus('conflict-4', job.id, 'ARCHIVED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('refuses to republish an already-published listing', async () => {
      await harness.becomeEmployer('conflict-5');
      const job = await publishedJob('conflict-5');

      await setStatus('conflict-5', job.id, 'PUBLISHED').expect(409);
    });

    it('refuses any move out of ARCHIVED', async () => {
      await harness.becomeEmployer('conflict-6');
      const job = await publishedJob('conflict-6');
      await deleteJob('conflict-6', job.id).expect(200);

      await setStatus('conflict-6', job.id, 'PUBLISHED').expect(409);
      await setStatus('conflict-6', job.id, 'CLOSED').expect(409);

      await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');
    });

    it('refuses a status change to another company’s listing with 403', async () => {
      await harness.becomeEmployer('owner-a', 'Owner Co');
      await harness.becomeEmployer('intruder-a', 'Intruder Co');
      const job = await harness.createJob('owner-a');

      await setStatus('intruder-a', job.id, 'PUBLISHED').expect(403);

      // The listing is untouched for its real owner.
      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('refuses a status change from a user without an employer profile', async () => {
      await harness.becomeEmployer('owner-b');
      const job = await harness.createJob('owner-b');

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
      await harness.becomeEmployer('validation-1');
      const job = await harness.createJob('validation-1');

      await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}/status`)
        .set('Authorization', harness.authHeader('validation-1'))
        .send(body)
        .expect(400);

      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('returns 404 for a listing that does not exist', async () => {
      await harness.becomeEmployer('missing-1');

      await setStatus('missing-1', UNKNOWN_ID, 'PUBLISHED').expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await harness.becomeEmployer('missing-2');

      await setStatus('missing-2', 'not-a-uuid', 'PUBLISHED').expect(400);
    });

    it('rejects an unauthenticated status change with 401', async () => {
      await request(harness.server)
        .patch(`${JOBS_URL}/${UNKNOWN_ID}/status`)
        .send({ status: 'PUBLISHED' })
        .expect(401);
    });
  });

  describe('DELETE /jobs/:id', () => {
    it.each(['DRAFT', 'PUBLISHED', 'CLOSED'])(
      'archives a %s listing instead of removing it',
      async (from) => {
        const sub = `del-${from}`;
        await harness.becomeEmployer(sub);
        const job = await harness.createJob(sub);
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
      await harness.becomeEmployer('del-mine');
      const job = await harness.createJob('del-mine');

      await deleteJob('del-mine', job.id).expect(200);

      const mine = await request(harness.server)
        .get(MINE_URL)
        .set('Authorization', harness.authHeader('del-mine'))
        .expect(200);
      expect(mine.body.total).toBe(1);
      expect(mine.body.items[0]).toMatchObject({
        id: job.id,
        status: 'ARCHIVED',
      });
    });

    it('is idempotent — deleting twice leaves it archived', async () => {
      await harness.becomeEmployer('del-twice');
      const job = await harness.createJob('del-twice');

      await deleteJob('del-twice', job.id).expect(200);
      const second = await deleteJob('del-twice', job.id).expect(200);

      expect(second.body).toMatchObject({ status: 'ARCHIVED' });
      await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');
    });

    it('refuses to delete another company’s listing with 403', async () => {
      await harness.becomeEmployer('owner-c', 'Owner Co');
      await harness.becomeEmployer('intruder-c', 'Intruder Co');
      const job = await publishedJob('owner-c');

      await deleteJob('intruder-c', job.id).expect(403);

      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
    });

    it('refuses a delete from a user without an employer profile', async () => {
      await harness.becomeEmployer('owner-d');
      const job = await harness.createJob('owner-d');

      const res = await deleteJob('no-profile-2', job.id).expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
    });

    it('returns 404 for a listing that does not exist', async () => {
      await harness.becomeEmployer('missing-3');

      await deleteJob('missing-3', UNKNOWN_ID).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await harness.becomeEmployer('missing-4');

      await deleteJob('missing-4', 'not-a-uuid').expect(400);
    });

    it('rejects an unauthenticated delete with 401', async () => {
      await request(harness.server)
        .delete(`${JOBS_URL}/${UNKNOWN_ID}`)
        .expect(401);
    });
  });

  describe('an archived listing is closed to further change', () => {
    it('refuses a content edit with 409', async () => {
      // The row is kept as a record of what happened, so nothing rewrites it.
      await harness.becomeEmployer('archived-edit');
      const job = await harness.createJob('archived-edit');
      await deleteJob('archived-edit', job.id).expect(200);

      await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('archived-edit'))
        .send({ title: 'Risen from the dead' })
        .expect(409);

      const rows = await harness.query<{ title: string }>(
        `SELECT title FROM jobs WHERE id = $1`,
        [job.id],
      );
      expect(rows[0].title).toBe(A_JOB.title);
    });

    it('still allows a content edit while the listing is closed', async () => {
      // Only ARCHIVED is terminal; a closed listing may still be corrected.
      await harness.becomeEmployer('closed-edit');
      const job = await publishedJob('closed-edit');
      await setStatus('closed-edit', job.id, 'CLOSED').expect(200);

      const res = await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('closed-edit'))
        .send({ title: 'Senior Backend Engineer (filled)' })
        .expect(200);

      expect(res.body).toMatchObject({
        title: 'Senior Backend Engineer (filled)',
        status: 'CLOSED',
      });
    });
  });

  describe('the lifecycle end to end', () => {
    it('walks draft → published → closed → archived, keeping the row', async () => {
      await harness.becomeEmployer('walk-1');
      const job = await harness.createJob('walk-1');

      await expect(storedStatus(job.id)).resolves.toBe('DRAFT');
      await setStatus('walk-1', job.id, 'PUBLISHED').expect(200);
      await expect(storedStatus(job.id)).resolves.toBe('PUBLISHED');
      await setStatus('walk-1', job.id, 'CLOSED').expect(200);
      await expect(storedStatus(job.id)).resolves.toBe('CLOSED');
      await deleteJob('walk-1', job.id).expect(200);
      await expect(storedStatus(job.id)).resolves.toBe('ARCHIVED');

      const rows = await harness.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM jobs WHERE id = $1`,
        [job.id],
      );
      expect(rows[0].count).toBe(1);
    });
  });
});
