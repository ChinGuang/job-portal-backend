/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import {
  A_JOB,
  JOBS_URL,
  JobListBody,
  ApiTestHarness,
} from './helpers/api.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

const UNKNOWN_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('Public job browsing (e2e)', () => {
  const harness = new ApiTestHarness();

  beforeAll(async () => {
    await harness.start();
  });

  afterEach(async () => {
    await harness.truncate();
  });

  afterAll(async () => {
    await harness.stop();
  });

  /** Browses as a visitor would: no token, no headers. */
  const browse = (query: Record<string, unknown> = {}) =>
    request(harness.server).get(JOBS_URL).query(query);

  /** Opens one listing as a visitor would. */
  const open = (id: string) => request(harness.server).get(`${JOBS_URL}/${id}`);

  const archive = (sub: string, id: string) =>
    request(harness.server)
      .delete(`${JOBS_URL}/${id}`)
      .set('Authorization', harness.authHeader(sub));

  const idsOf = (body: JobListBody) => body.items.map((job) => job.id);

  describe('GET /jobs', () => {
    it('lists published listings to a caller with no token at all', async () => {
      await harness.becomeEmployer('browse-1');
      const job = await harness.publishJob('browse-1');

      const res = await browse().expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        id: job.id,
        title: A_JOB.title,
        description: A_JOB.description,
        location: A_JOB.location,
        jobType: A_JOB.jobType,
        status: 'PUBLISHED',
      });
    });

    it('returns an empty page rather than an error when nothing is published', async () => {
      const res = await browse().expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it.each(['DRAFT', 'CLOSED', 'ARCHIVED'])(
      'omits a %s listing from the list',
      async (status) => {
        const sub = `hidden-${status}`;
        await harness.becomeEmployer(sub);
        const visible = await harness.publishJob(sub, { title: 'Visible' });
        const hidden = await harness.createJob(sub, { title: 'Hidden' });
        if (status !== 'DRAFT') {
          await harness.setJobStatus(sub, hidden.id, 'PUBLISHED').expect(200);
        }
        if (status === 'CLOSED') {
          await harness.setJobStatus(sub, hidden.id, 'CLOSED').expect(200);
        }
        if (status === 'ARCHIVED') {
          await archive(sub, hidden.id).expect(200);
        }

        const res = await browse().expect(200);

        expect(idsOf(res.body as JobListBody)).toEqual([visible.id]);
        expect(res.body.total).toBe(1);
      },
    );

    it('never leaks another employer’s drafts', async () => {
      await harness.becomeEmployer('leak-owner', 'Owner Co');
      await harness.createJob('leak-owner', { title: 'Secret role' });

      const res = await browse().expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });
  });

  describe('GET /jobs — pagination', () => {
    /** Publishes `count` listings, titled "Role 1" … "Role n". */
    const publishMany = async (sub: string, count: number): Promise<void> => {
      await harness.becomeEmployer(sub);
      for (let i = 1; i <= count; i += 1) {
        await harness.publishJob(sub, { title: `Role ${i}` });
      }
    };

    it('counts every match, not just the page returned', async () => {
      await publishMany('page-1', 5);

      const res = await browse({ limit: 2 }).expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it('walks disjoint pages that together cover every listing', async () => {
      await publishMany('page-2', 5);

      const first = await browse({ limit: 2, offset: 0 }).expect(200);
      const second = await browse({ limit: 2, offset: 2 }).expect(200);
      const third = await browse({ limit: 2, offset: 4 }).expect(200);

      const seen = [
        ...idsOf(first.body as JobListBody),
        ...idsOf(second.body as JobListBody),
        ...idsOf(third.body as JobListBody),
      ];
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
      expect(third.body.items).toHaveLength(1);
    });

    it('returns an empty page past the end without erroring', async () => {
      await publishMany('page-3', 2);

      const res = await browse({ offset: 50 }).expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(2);
    });

    it.each([
      ['a zero limit', { limit: 0 }],
      ['a negative limit', { limit: -1 }],
      ['a limit past the maximum', { limit: 101 }],
      ['a fractional limit', { limit: 1.5 }],
      ['a non-numeric limit', { limit: 'ten' }],
      ['a negative offset', { offset: -1 }],
      ['a non-numeric offset', { offset: 'ten' }],
      ['an unknown query parameter', { sortBy: 'salary' }],
    ])('rejects %s with 400', async (_label, query) => {
      await browse(query).expect(400);
    });
  });

  describe('GET /jobs — filters', () => {
    it('filters by job type', async () => {
      await harness.becomeEmployer('type-1');
      const contract = await harness.publishJob('type-1', {
        jobType: 'CONTRACT',
      });
      await harness.publishJob('type-1', { jobType: 'FULL_TIME' });

      const res = await browse({ jobType: 'CONTRACT' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([contract.id]);
      expect(res.body.total).toBe(1);
    });

    it('filters by location', async () => {
      await harness.becomeEmployer('loc-1');
      const kl = await harness.publishJob('loc-1', {
        location: 'Kuala Lumpur',
      });
      await harness.publishJob('loc-1', { location: 'Singapore' });

      const res = await browse({ location: 'Kuala Lumpur' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([kl.id]);
    });

    it('matches a location regardless of the case typed', async () => {
      await harness.becomeEmployer('loc-2');
      const kl = await harness.publishJob('loc-2', {
        location: 'Kuala Lumpur',
      });

      const res = await browse({ location: 'kuala lumpur' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([kl.id]);
    });

    it('matches a location the visitor named only part of', async () => {
      await harness.becomeEmployer('loc-3');
      const kl = await harness.publishJob('loc-3', {
        location: 'Kuala Lumpur, Malaysia',
      });

      const res = await browse({ location: 'Malaysia' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([kl.id]);
    });

    it('combines the type and location filters', async () => {
      await harness.becomeEmployer('combo-1');
      const wanted = await harness.publishJob('combo-1', {
        jobType: 'INTERNSHIP',
        location: 'Penang',
      });
      await harness.publishJob('combo-1', {
        jobType: 'INTERNSHIP',
        location: 'Singapore',
      });
      await harness.publishJob('combo-1', {
        jobType: 'FULL_TIME',
        location: 'Penang',
      });

      const res = await browse({
        jobType: 'INTERNSHIP',
        location: 'Penang',
      }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([wanted.id]);
      expect(res.body.total).toBe(1);
    });

    it('never returns an unpublished listing that matches the filters', async () => {
      await harness.becomeEmployer('filter-draft');
      await harness.createJob('filter-draft', {
        jobType: 'CONTRACT',
        location: 'Penang',
      });

      const res = await browse({
        jobType: 'CONTRACT',
        location: 'Penang',
      }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('ignores the spaces a visitor typed around a location', async () => {
      await harness.becomeEmployer('loc-4');
      const kl = await harness.publishJob('loc-4', {
        location: 'Kuala Lumpur',
      });

      const res = await browse({ location: '  Kuala Lumpur  ' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([kl.id]);
    });

    it('reads a blank location as no filter at all', async () => {
      await harness.becomeEmployer('loc-5');
      const job = await harness.publishJob('loc-5');

      const res = await browse({ location: '   ' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([job.id]);
    });

    it('rejects an unknown job type with 400', async () => {
      await browse({ jobType: 'PERMANENT_VACATION' }).expect(400);
    });
  });

  describe('GET /jobs — keyword search', () => {
    it('finds a listing by a word in its title, whatever the case', async () => {
      await harness.becomeEmployer('kw-1');
      const rust = await harness.publishJob('kw-1', {
        title: 'Senior Rust Engineer',
      });
      await harness.publishJob('kw-1', { title: 'Senior Go Engineer' });

      const res = await browse({ keyword: 'rust' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([rust.id]);
    });

    it('finds a listing by a word in its description', async () => {
      await harness.becomeEmployer('kw-2');
      const kafka = await harness.publishJob('kw-2', {
        title: 'Platform Engineer',
        description: 'You will own our Kafka pipelines.',
      });
      await harness.publishJob('kw-2', {
        title: 'Frontend Engineer',
        description: 'You will own our design system.',
      });

      const res = await browse({ keyword: 'kafka' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([kafka.id]);
    });

    it('returns an empty page when nothing matches', async () => {
      await harness.becomeEmployer('kw-3');
      await harness.publishJob('kw-3');

      const res = await browse({ keyword: 'cobol' }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('treats a LIKE wildcard as an ordinary character', async () => {
      // A bare "%" must not behave as "match everything".
      await harness.becomeEmployer('kw-4');
      await harness.publishJob('kw-4', { title: 'Senior Backend Engineer' });

      const res = await browse({ keyword: '%' }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('narrows the count to the matching listings', async () => {
      await harness.becomeEmployer('kw-5');
      await harness.publishJob('kw-5', { title: 'Rust Engineer' });
      await harness.publishJob('kw-5', { title: 'Go Engineer' });
      await harness.publishJob('kw-5', { title: 'Java Engineer' });

      const res = await browse({ keyword: 'engineer' }).expect(200);

      expect(res.body.total).toBe(3);
    });

    it('applies the keyword alongside a filter', async () => {
      await harness.becomeEmployer('kw-6');
      const wanted = await harness.publishJob('kw-6', {
        title: 'Rust Engineer',
        jobType: 'CONTRACT',
      });
      await harness.publishJob('kw-6', {
        title: 'Rust Engineer',
        jobType: 'FULL_TIME',
      });

      const res = await browse({
        keyword: 'rust',
        jobType: 'CONTRACT',
      }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([wanted.id]);
    });

    it('never surfaces an unpublished listing that matches the keyword', async () => {
      await harness.becomeEmployer('kw-7');
      await harness.createJob('kw-7', { title: 'Secret Rust Engineer' });

      const res = await browse({ keyword: 'rust' }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('treats a single-character LIKE wildcard as an ordinary character', async () => {
      // "_" matches any one character to LIKE, so an unescaped "a_b" would
      // find "axb". Only a listing literally containing "a_b" should match.
      await harness.becomeEmployer('kw-8');
      const literal = await harness.publishJob('kw-8', { title: 'Role a_b' });
      await harness.publishJob('kw-8', { title: 'Role axb' });

      const res = await browse({ keyword: 'a_b' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([literal.id]);
    });

    it('ignores the spaces a visitor typed around a keyword', async () => {
      await harness.becomeEmployer('kw-9');
      const rust = await harness.publishJob('kw-9', { title: 'Rust Engineer' });

      const res = await browse({ keyword: '  rust  ' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([rust.id]);
    });

    it('reads a blank keyword as no keyword at all', async () => {
      // An empty search box must not narrow the board to nothing.
      await harness.becomeEmployer('kw-10');
      const job = await harness.publishJob('kw-10');

      const res = await browse({ keyword: '   ' }).expect(200);

      expect(idsOf(res.body as JobListBody)).toEqual([job.id]);
    });

    it('accepts a keyword as long as the longest storable description', async () => {
      // The bound follows the longest searched field, so a phrase a
      // description could genuinely contain is searched, not refused.
      await harness.becomeEmployer('kw-11');
      await harness.publishJob('kw-11');

      const res = await browse({ keyword: 'x'.repeat(10000) }).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('rejects a keyword longer than anything that could be stored', async () => {
      await browse({ keyword: 'x'.repeat(10001) }).expect(400);
    });
  });

  describe('GET /jobs/:id', () => {
    it('opens a published listing for a caller with no token', async () => {
      await harness.becomeEmployer('open-1');
      const job = await harness.publishJob('open-1');

      const res = await open(job.id).expect(200);

      expect(res.body).toMatchObject({
        id: job.id,
        title: A_JOB.title,
        description: A_JOB.description,
        requirements: A_JOB.requirements,
        location: A_JOB.location,
        jobType: A_JOB.jobType,
        status: 'PUBLISHED',
      });
    });

    it('still opens a closed listing, so a candidate sees the role is gone', async () => {
      await harness.becomeEmployer('open-2');
      const job = await harness.publishJob('open-2');
      await harness.setJobStatus('open-2', job.id, 'CLOSED').expect(200);

      const res = await open(job.id).expect(200);

      expect(res.body).toMatchObject({ id: job.id, status: 'CLOSED' });
    });

    it('hides a draft behind a 404', async () => {
      await harness.becomeEmployer('open-3');
      const job = await harness.createJob('open-3');

      await open(job.id).expect(404);
    });

    it('hides an archived listing behind a 404', async () => {
      await harness.becomeEmployer('open-4');
      const job = await harness.publishJob('open-4');
      await archive('open-4', job.id).expect(200);

      await open(job.id).expect(404);
    });

    it('returns 404 for a listing that does not exist', async () => {
      await open(UNKNOWN_ID).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await open('not-a-uuid').expect(400);
    });

    it('carries the employer’s public profile alongside the listing', async () => {
      const profile = await harness.becomeEmployer('open-5', 'Rocket Labs', {
        websiteUrl: 'https://rocketlabs.example.com',
        industry: 'Aerospace',
        companySize: '11-50',
        description: 'We build small rockets.',
        address: '1 Launch Road, Kuala Lumpur',
      });
      const job = await harness.publishJob('open-5');

      const res = await open(job.id).expect(200);

      expect(res.body.employer).toMatchObject({
        id: profile.id,
        companyName: 'Rocket Labs',
        websiteUrl: 'https://rocketlabs.example.com',
        industry: 'Aerospace',
        companySize: '11-50',
        description: 'We build small rockets.',
        address: '1 Launch Road, Kuala Lumpur',
      });
    });

    it('keeps the employer’s account plumbing out of the public profile', async () => {
      // A visitor has no business knowing which user account owns a company.
      await harness.becomeEmployer('open-6', 'Rocket Labs');
      const job = await harness.publishJob('open-6');

      const res = await open(job.id).expect(200);

      expect(res.body.employer).not.toHaveProperty('userId');
      expect(res.body.employer).not.toHaveProperty('deletedAt');
    });
  });

  describe('the employer’s own feed stays separate from the public one', () => {
    it('shows an employer their draft while hiding it from visitors', async () => {
      await harness.becomeEmployer('separate-1');
      const draft = await harness.createJob('separate-1', { title: 'Draft' });

      const mine = await request(harness.server)
        .get(`${JOBS_URL}/mine`)
        .set('Authorization', harness.authHeader('separate-1'))
        .expect(200);
      const publicList = await browse().expect(200);

      expect(idsOf(mine.body as JobListBody)).toEqual([draft.id]);
      expect(publicList.body).toEqual({ items: [], total: 0 });
    });

    it('does not read "mine" as a listing id on the public route', async () => {
      // GET /jobs/mine is the employer feed and must stay authenticated.
      await open('mine').expect(401);
    });
  });

  describe('listings from several employers', () => {
    it('lists every company’s published roles together', async () => {
      await harness.becomeEmployer('multi-a', 'Alpha Co');
      await harness.becomeEmployer('multi-b', 'Beta Co');
      const alpha = await harness.publishJob('multi-a', {
        title: 'Alpha role',
      });
      const beta = await harness.publishJob('multi-b', { title: 'Beta role' });

      const res = await browse().expect(200);

      expect(res.body.total).toBe(2);
      expect(idsOf(res.body as JobListBody).sort()).toEqual(
        [alpha.id, beta.id].sort(),
      );
    });

    it('names the right company on each listing', async () => {
      await harness.becomeEmployer('multi-c', 'Gamma Co');
      await harness.becomeEmployer('multi-d', 'Delta Co');
      const gamma = await harness.publishJob('multi-c');
      const delta = await harness.publishJob('multi-d');

      const gammaRes = await open(gamma.id).expect(200);
      const deltaRes = await open(delta.id).expect(200);

      expect(gammaRes.body.employer.companyName).toBe('Gamma Co');
      expect(deltaRes.body.employer.companyName).toBe('Delta Co');
    });
  });

  it('does not require a token on either public route', async () => {
    await harness.becomeEmployer('anon-1');
    const job = await harness.publishJob('anon-1');

    // No Authorization header is set anywhere in this assertion.
    await browse().expect(200);
    await open(job.id).expect(200);
  });

  it('ignores a garbage token rather than 401ing a public read', async () => {
    await harness.becomeEmployer('anon-2');
    const job = await harness.publishJob('anon-2');

    await request(harness.server)
      .get(JOBS_URL)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(200);
    await request(harness.server)
      .get(`${JOBS_URL}/${job.id}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(200);
  });
});
