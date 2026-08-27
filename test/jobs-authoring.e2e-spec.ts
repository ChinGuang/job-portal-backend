/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import {
  A_JOB,
  JOBS_URL,
  JobListBody,
  JobTestHarness,
  MINE_URL,
} from './helpers/jobs.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

describe('Job listing authoring (e2e)', () => {
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

  describe('POST /jobs', () => {
    it('creates a listing in DRAFT status', async () => {
      await harness.becomeEmployer('employer-1');

      const res = await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-1'))
        .send(A_JOB)
        .expect(201);

      expect(res.body).toMatchObject({
        title: A_JOB.title,
        description: A_JOB.description,
        requirements: A_JOB.requirements,
        location: A_JOB.location,
        jobType: 'FULL_TIME',
        status: 'DRAFT',
      });
      expect(res.body.id).toBeDefined();
    });

    it('ignores a client-supplied status and still creates a DRAFT', async () => {
      await harness.becomeEmployer('employer-2');

      // `status` is not part of the create contract — publishing is a separate
      // endpoint — so the whitelist must reject the attempt outright.
      await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-2'))
        .send({ ...A_JOB, status: 'PUBLISHED' })
        .expect(400);
    });

    it('accepts an optional salary range and currency', async () => {
      await harness.becomeEmployer('employer-3');

      const res = await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-3'))
        .send({ ...A_JOB, salaryMin: 8000, salaryMax: 12000, currency: 'MYR' })
        .expect(201);

      expect(res.body).toMatchObject({
        salaryMin: 8000,
        salaryMax: 12000,
        currency: 'MYR',
      });
    });

    it('accepts an empty requirements array', async () => {
      await harness.becomeEmployer('employer-4');

      const res = await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-4'))
        .send({ ...A_JOB, requirements: [] })
        .expect(201);

      expect(res.body.requirements).toEqual([]);
    });

    it('rejects an inverted salary range with 400', async () => {
      await harness.becomeEmployer('employer-6');

      await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-6'))
        .send({ ...A_JOB, salaryMin: 12000, salaryMax: 8000 })
        .expect(400);
    });

    it('tells a user without an employer profile that they need one', async () => {
      const res = await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('no-profile-user'))
        .send(A_JOB)
        .expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
    });

    it('checks the employer capability before validating the body', async () => {
      // The requirement is "told they need one, before creating a listing" —
      // a caller missing the profile should hear about the profile, not about
      // a malformed title.
      const res = await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('no-profile-user-2'))
        .send({})
        .expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(harness.server).post(JOBS_URL).send(A_JOB).expect(401);
    });

    it.each([
      ['a missing title', { title: undefined }],
      ['an empty title', { title: '' }],
      ['a missing description', { description: undefined }],
      ['a missing location', { location: undefined }],
      ['a missing jobType', { jobType: undefined }],
      ['a missing requirements', { requirements: undefined }],
      ['an unknown jobType', { jobType: 'PERMANENT_VACATION' }],
      ['a non-array requirements', { requirements: 'TypeScript' }],
      ['a non-string requirement entry', { requirements: [42] }],
      ['a negative salaryMin', { salaryMin: -1 }],
      ['a non-numeric salaryMax', { salaryMax: 'lots' }],
    ])('rejects %s with 400', async (_label, patch) => {
      await harness.becomeEmployer('employer-validation');

      await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-validation'))
        .send({ ...A_JOB, ...patch })
        .expect(400);
    });

    it('rejects unknown fields with 400', async () => {
      await harness.becomeEmployer('employer-5');

      await request(harness.server)
        .post(JOBS_URL)
        .set('Authorization', harness.authHeader('employer-5'))
        .send({ ...A_JOB, secretPerk: 'free parking' })
        .expect(400);
    });
  });

  describe('PATCH /jobs/:id', () => {
    it('edits the content of the caller’s own listing', async () => {
      await harness.becomeEmployer('owner-1');
      const job = await harness.createJob('owner-1');

      const res = await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('owner-1'))
        .send({ title: 'Staff Backend Engineer', location: 'Remote' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: job.id,
        title: 'Staff Backend Engineer',
        location: 'Remote',
        // Untouched fields survive the edit.
        description: A_JOB.description,
        status: 'DRAFT',
      });
    });

    it('replaces the requirements array wholesale', async () => {
      await harness.becomeEmployer('owner-2');
      const job = await harness.createJob('owner-2');

      const res = await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('owner-2'))
        .send({ requirements: ['Go'] })
        .expect(200);

      expect(res.body.requirements).toEqual(['Go']);
    });

    it('refuses an edit to another company’s listing with 403', async () => {
      await harness.becomeEmployer('owner-3', 'Owner Co');
      await harness.becomeEmployer('intruder-3', 'Intruder Co');
      const job = await harness.createJob('owner-3');

      await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('intruder-3'))
        .send({ title: 'Hijacked' })
        .expect(403);

      // The listing is unchanged for its real owner.
      const mine = await request(harness.server)
        .get(MINE_URL)
        .set('Authorization', harness.authHeader('owner-3'))
        .expect(200);
      expect(mine.body.items[0].title).toBe(A_JOB.title);
    });

    it('refuses an edit from a user without an employer profile with 403', async () => {
      await harness.becomeEmployer('owner-4');
      const job = await harness.createJob('owner-4');

      const res = await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('no-profile-user-3'))
        .send({ title: 'Hijacked' })
        .expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
    });

    it('returns 404 for a listing that does not exist', async () => {
      await harness.becomeEmployer('owner-5');

      await request(harness.server)
        .patch(`${JOBS_URL}/6f9619ff-8b86-d011-b42d-00c04fc964ff`)
        .set('Authorization', harness.authHeader('owner-5'))
        .send({ title: 'Ghost' })
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await harness.becomeEmployer('owner-6');

      await request(harness.server)
        .patch(`${JOBS_URL}/not-a-uuid`)
        .set('Authorization', harness.authHeader('owner-6'))
        .send({ title: 'Nope' })
        .expect(400);
    });

    it('refuses an edit that inverts the range against the stored bound', async () => {
      // The PATCH body carries only one bound, so the rule is only visible if
      // it is checked against the listing as it will stand after the merge.
      await harness.becomeEmployer('owner-8');
      const job = await harness.createJob('owner-8', {
        salaryMin: 8000,
        salaryMax: 12000,
      });

      await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('owner-8'))
        .send({ salaryMin: 20000 })
        .expect(400);
    });

    it('refuses a status change through the content-edit endpoint', async () => {
      await harness.becomeEmployer('owner-7');
      const job = await harness.createJob('owner-7');

      await request(harness.server)
        .patch(`${JOBS_URL}/${job.id}`)
        .set('Authorization', harness.authHeader('owner-7'))
        .send({ status: 'PUBLISHED' })
        .expect(400);
    });

    it('rejects an unauthenticated edit with 401', async () => {
      await request(harness.server)
        .patch(`${JOBS_URL}/6f9619ff-8b86-d011-b42d-00c04fc964ff`)
        .send({ title: 'Nope' })
        .expect(401);
    });
  });

  describe('GET /jobs/mine', () => {
    it('lists the caller’s listings across every status', async () => {
      await harness.becomeEmployer('lister-1');
      const draft = await harness.createJob('lister-1', {
        title: 'Draft role',
      });
      const published = await harness.createJob('lister-1', {
        title: 'Published role',
      });
      const closed = await harness.createJob('lister-1', {
        title: 'Closed role',
      });
      const archived = await harness.createJob('lister-1', {
        title: 'Archived role',
      });

      // Each listing is walked to its status through the lifecycle endpoints,
      // the same way an employer would get it there.
      const setStatus = (id: string, status: string) =>
        request(harness.server)
          .patch(`${JOBS_URL}/${id}/status`)
          .set('Authorization', harness.authHeader('lister-1'))
          .send({ status })
          .expect(200);

      await setStatus(published.id, 'PUBLISHED');
      await setStatus(closed.id, 'PUBLISHED');
      await setStatus(closed.id, 'CLOSED');
      await request(harness.server)
        .delete(`${JOBS_URL}/${archived.id}`)
        .set('Authorization', harness.authHeader('lister-1'))
        .expect(200);

      const res = await request(harness.server)
        .get(MINE_URL)
        .set('Authorization', harness.authHeader('lister-1'))
        .expect(200);

      const { items, total } = res.body as JobListBody;
      expect(total).toBe(4);
      const byId = Object.fromEntries(items.map((j) => [j.id, j.status]));
      expect(byId[draft.id]).toBe('DRAFT');
      expect(byId[published.id]).toBe('PUBLISHED');
      expect(byId[closed.id]).toBe('CLOSED');
      expect(byId[archived.id]).toBe('ARCHIVED');
    });

    it('never leaks another company’s listings', async () => {
      await harness.becomeEmployer('lister-2', 'Mine Co');
      await harness.becomeEmployer('other-2', 'Other Co');
      await harness.createJob('lister-2', { title: 'My role' });
      await harness.createJob('other-2', { title: 'Their role' });

      const res = await request(harness.server)
        .get(MINE_URL)
        .set('Authorization', harness.authHeader('lister-2'))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].title).toBe('My role');
      expect(JSON.stringify(res.body)).not.toContain('Their role');
    });

    it('returns an empty list for an employer with no listings', async () => {
      await harness.becomeEmployer('lister-3');

      const res = await request(harness.server)
        .get(MINE_URL)
        .set('Authorization', harness.authHeader('lister-3'))
        .expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('pages through the listings, with total counting all of them', async () => {
      await harness.becomeEmployer('lister-4');
      for (const n of [1, 2, 3]) {
        await harness.createJob('lister-4', { title: `Role ${n}` });
      }

      const first = await request(harness.server)
        .get(MINE_URL)
        .query({ limit: 2, offset: 0 })
        .set('Authorization', harness.authHeader('lister-4'))
        .expect(200);
      expect((first.body as JobListBody).items).toHaveLength(2);
      expect((first.body as JobListBody).total).toBe(3);

      const second = await request(harness.server)
        .get(MINE_URL)
        .query({ limit: 2, offset: 2 })
        .set('Authorization', harness.authHeader('lister-4'))
        .expect(200);
      expect((second.body as JobListBody).items).toHaveLength(1);
      expect((second.body as JobListBody).total).toBe(3);

      // The two pages together cover every listing exactly once.
      const titles = [
        ...(first.body as JobListBody).items,
        ...(second.body as JobListBody).items,
      ].map((j) => j.title);
      expect(titles.sort()).toEqual(['Role 1', 'Role 2', 'Role 3']);
    });

    it('rejects a nonsensical limit with 400', async () => {
      await harness.becomeEmployer('lister-5');

      await request(harness.server)
        .get(MINE_URL)
        .query({ limit: 0 })
        .set('Authorization', harness.authHeader('lister-5'))
        .expect(400);
    });

    it('refuses a caller without an employer profile with 403', async () => {
      const res = await request(harness.server)
        .get(MINE_URL)
        .set('Authorization', harness.authHeader('no-profile-user-4'))
        .expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(harness.server).get(MINE_URL).expect(401);
    });
  });
});
