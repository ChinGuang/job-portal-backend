/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import { ApiTestHarness, ApplicationBody } from './helpers/api.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

const MY_APPLICATIONS_URL = '/applications/mine';
const APPLICATIONS_URL = '/applications';

const applyUrl = (jobId: string) => `/jobs/${jobId}/applications`;

// A well-formed id that belongs to nothing, for the "not found" cases.
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** Only the detail route carries the listing, so only this suite knows it. */
interface ApplicationDetailBody extends ApplicationBody {
  job?: { id: string; title: string; status: string };
}

describe('Applying to a job (e2e)', () => {
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

  /** The state in which applying is meant to just work. */
  async function arrangePublishedJobAndSeeker(
    employer = 'employer',
    seeker = 'seeker',
  ) {
    await harness.becomeEmployer(employer);
    const job = await harness.publishJob(employer);
    const { profile, resumeUrl } =
      await harness.becomeJobSeekerWithResume(seeker);
    return { job, profile, resumeUrl };
  }

  function apply(seeker: string, jobId: string, body: object = {}) {
    return request(harness.server)
      .post(applyUrl(jobId))
      .set('Authorization', harness.authHeader(seeker))
      .send(body);
  }

  describe('POST /jobs/:id/applications', () => {
    it('records a SUBMITTED application against the published listing', async () => {
      const { job, profile } = await arrangePublishedJobAndSeeker();

      const res = await apply('seeker', job.id, {
        coverLetter: 'I would love to work on this.',
      }).expect(201);

      const body = res.body as ApplicationBody;
      expect(body).toMatchObject({
        jobId: job.id,
        jobSeekerProfileId: profile.id,
        coverLetter: 'I would love to work on this.',
        status: 'SUBMITTED',
      });
      expect(body.id).toBeDefined();
    });

    it('applies on the résumé alone, with no cover letter', async () => {
      const { job } = await arrangePublishedJobAndSeeker();

      const res = await apply('seeker', job.id).expect(201);

      expect((res.body as ApplicationBody).coverLetter).toBeNull();
    });

    it('treats a blank cover letter as an absent one rather than a 400', async () => {
      const { job } = await arrangePublishedJobAndSeeker();

      const res = await apply('seeker', job.id, {
        coverLetter: '   ',
      }).expect(201);

      expect((res.body as ApplicationBody).coverLetter).toBeNull();
    });

    it("snapshots the profile's résumé when the request names none", async () => {
      const { job, resumeUrl } = await arrangePublishedJobAndSeeker();

      const res = await apply('seeker', job.id).expect(201);

      expect((res.body as ApplicationBody).resumeUrl).toBe(resumeUrl);
    });

    it('prefers a résumé named on the request over the profile one', async () => {
      const { job, profile, resumeUrl } = await arrangePublishedJobAndSeeker();
      // The tailored-CV case. No per-application upload endpoint exists yet,
      // so the object goes in directly.
      const tailored = `${profile.id}/tailored-resume.pdf`;
      await harness.storage.upload(
        tailored,
        Buffer.from('%PDF-1.4 tailored'),
        'application/pdf',
      );

      const res = await apply('seeker', job.id, {
        resumeUrl: tailored,
      }).expect(201);

      const body = res.body as ApplicationBody;
      expect(body.resumeUrl).toBe(tailored);
      expect(body.resumeUrl).not.toBe(resumeUrl);
    });

    it('refuses a résumé key of its own that was never uploaded', async () => {
      const { job, profile } = await arrangePublishedJobAndSeeker();

      // Own-prefixed, so ownership passes, but nothing is stored there.
      const res = await apply('seeker', job.id, {
        resumeUrl: `${profile.id}/never-uploaded.pdf`,
      }).expect(400);

      expect(res.body.message).toMatch(/has not been uploaded/i);
    });

    it('cannot dodge the no-résumé refusal by inventing a key', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');
      const profile = await harness.becomeJobSeeker('resumeless');

      await apply('resumeless', job.id, {
        resumeUrl: `${profile.id}/resume.pdf`,
      }).expect(400);

      const rows = await harness.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM applications',
        [],
      );
      expect(rows[0].count).toBe('0');
    });

    it('copies no file: the snapshot is only a reference to the stored one', async () => {
      const { job, resumeUrl } = await arrangePublishedJobAndSeeker();

      await apply('seeker', job.id).expect(201);

      // Applying uploaded nothing; it recorded an existing object's key.
      expect(harness.storage.has(resumeUrl)).toBe(true);
    });

    it("refuses a résumé belonging to another seeker's profile", async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const other = await harness.becomeJobSeeker('other-seeker');

      const res = await apply('seeker', job.id, {
        resumeUrl: `${other.id}/resume.pdf`,
      }).expect(400);

      expect(res.body.message).toMatch(/your own job seeker profile/i);
    });

    it('refuses to apply with no résumé on the request or the profile', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');
      await harness.becomeJobSeeker('resumeless');

      const res = await apply('resumeless', job.id).expect(400);

      expect(res.body.message).toMatch(/résumé/i);
      expect(res.body.message).toMatch(/profiles\/job-seeker\/resume/);
    });

    it('returns 409 on a second application to the same listing', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      await apply('seeker', job.id).expect(201);

      const res = await apply('seeker', job.id, {
        coverLetter: 'Trying again.',
      }).expect(409);

      expect(res.body.message).toMatch(/already applied/i);
    });

    it('keeps exactly one application after a repeat attempt', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      await apply('seeker', job.id).expect(201);
      await apply('seeker', job.id).expect(409);

      const rows = await harness.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM applications WHERE "jobId" = $1',
        [job.id],
      );
      expect(rows[0].count).toBe('1');
    });

    it('lets two different seekers apply to the same listing', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      await harness.becomeJobSeekerWithResume('seeker-2', 'Grace Hopper');

      await apply('seeker', job.id).expect(201);
      await apply('seeker-2', job.id).expect(201);
    });

    it('lets one seeker apply to two different listings', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const second = await harness.publishJob('employer', {
        title: 'Platform Engineer',
      });

      await apply('seeker', job.id).expect(201);
      await apply('seeker', second.id).expect(201);
    });

    it('hides a DRAFT listing behind a 404 rather than admitting it exists', async () => {
      await harness.becomeEmployer('employer');
      const draft = await harness.createJob('employer');
      await harness.becomeJobSeekerWithResume('seeker');

      await apply('seeker', draft.id).expect(404);
    });

    it('hides an ARCHIVED listing behind a 404', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      await request(harness.server)
        .delete(`/jobs/${job.id}`)
        .set('Authorization', harness.authHeader('employer'))
        .expect(200);

      await apply('seeker', job.id).expect(404);
    });

    it('tells a seeker plainly that a CLOSED listing has stopped accepting', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      await harness.setJobStatus('employer', job.id, 'CLOSED').expect(200);

      const res = await apply('seeker', job.id).expect(409);

      expect(res.body.message).toMatch(/no longer accepting/i);
    });

    it('returns 404 for a listing id that belongs to nothing', async () => {
      await harness.becomeJobSeekerWithResume('seeker');

      await apply('seeker', UNKNOWN_ID).expect(404);
    });

    it('rejects a malformed listing id with 400', async () => {
      await harness.becomeJobSeekerWithResume('seeker');

      await request(harness.server)
        .post(applyUrl('not-a-uuid'))
        .set('Authorization', harness.authHeader('seeker'))
        .send({})
        .expect(400);
    });

    it('tells a user without a job seeker profile that they need one', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');

      const res = await apply('no-profile-user', job.id).expect(403);

      expect(res.body.message).toMatch(/job seeker profile/i);
    });

    it('checks the job seeker capability before validating the body', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');

      // A caller missing the profile should hear about the profile, not about
      // a malformed cover letter.
      const res = await apply('no-profile-user', job.id, {
        coverLetter: 42,
      }).expect(403);

      expect(res.body.message).toMatch(/job seeker profile/i);
    });

    it('rejects an unauthenticated application with 401', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');

      await request(harness.server).post(applyUrl(job.id)).send({}).expect(401);
    });

    it('rejects a client-supplied status outright', async () => {
      const { job } = await arrangePublishedJobAndSeeker();

      // Status is not part of the apply contract, so the whitelist refuses it.
      await apply('seeker', job.id, { status: 'OFFERED' }).expect(400);
    });
  });

  describe('GET /applications/mine', () => {
    it("lists the caller's applications with their current status", async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      await apply('seeker', job.id).expect(201);

      const res = await request(harness.server)
        .get(MY_APPLICATIONS_URL)
        .set('Authorization', harness.authHeader('seeker'))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        jobId: job.id,
        status: 'SUBMITTED',
      });
    });

    it('is empty for a seeker who has not applied to anything', async () => {
      await harness.becomeJobSeekerWithResume('seeker');

      const res = await request(harness.server)
        .get(MY_APPLICATIONS_URL)
        .set('Authorization', harness.authHeader('seeker'))
        .expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it("shows a seeker only their own applications, never another's", async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const second = await harness.publishJob('employer', { title: 'Two' });
      await harness.becomeJobSeekerWithResume('seeker-2', 'Grace Hopper');

      await apply('seeker', job.id).expect(201);
      await apply('seeker-2', second.id).expect(201);

      const res = await request(harness.server)
        .get(MY_APPLICATIONS_URL)
        .set('Authorization', harness.authHeader('seeker-2'))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].jobId).toBe(second.id);
    });

    it('pages, and counts every application rather than just the page', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const second = await harness.publishJob('employer', { title: 'Two' });
      await apply('seeker', job.id).expect(201);
      await apply('seeker', second.id).expect(201);

      const res = await request(harness.server)
        .get(MY_APPLICATIONS_URL)
        .query({ limit: 1 })
        .set('Authorization', harness.authHeader('seeker'))
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(2);
    });

    it('tells a user without a job seeker profile that they need one', async () => {
      const res = await request(harness.server)
        .get(MY_APPLICATIONS_URL)
        .set('Authorization', harness.authHeader('no-profile-user'))
        .expect(403);

      expect(res.body.message).toMatch(/job seeker profile/i);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(harness.server).get(MY_APPLICATIONS_URL).expect(401);
    });
  });

  describe('GET /applications/:id', () => {
    it('opens one application together with the listing it was for', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const created = await apply('seeker', job.id, {
        coverLetter: 'Hello.',
      }).expect(201);
      const id = (created.body as ApplicationDetailBody).id;

      const res = await request(harness.server)
        .get(`${APPLICATIONS_URL}/${id}`)
        .set('Authorization', harness.authHeader('seeker'))
        .expect(200);

      const body = res.body as ApplicationDetailBody;
      expect(body).toMatchObject({
        id,
        coverLetter: 'Hello.',
        status: 'SUBMITTED',
      });
      expect(body.job).toMatchObject({
        id: job.id,
        title: job.title,
        status: 'PUBLISHED',
      });
    });

    it('still shows the listing after the employer has closed it', async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const created = await apply('seeker', job.id).expect(201);
      await harness.setJobStatus('employer', job.id, 'CLOSED').expect(200);

      const res = await request(harness.server)
        .get(
          `${APPLICATIONS_URL}/${(created.body as ApplicationDetailBody).id}`,
        )
        .set('Authorization', harness.authHeader('seeker'))
        .expect(200);

      // The public read path hides an ended role; the seeker who applied to it
      // still sees what became of it.
      expect((res.body as ApplicationDetailBody).job?.status).toBe('CLOSED');
    });

    it("refuses to reveal another seeker's application", async () => {
      const { job } = await arrangePublishedJobAndSeeker();
      const created = await apply('seeker', job.id).expect(201);
      await harness.becomeJobSeekerWithResume('nosy', 'Nosy Parker');

      // 404, not 403: a 403 would confirm the application exists.
      await request(harness.server)
        .get(
          `${APPLICATIONS_URL}/${(created.body as ApplicationDetailBody).id}`,
        )
        .set('Authorization', harness.authHeader('nosy'))
        .expect(404);
    });

    it('returns 404 for an application id that belongs to nothing', async () => {
      await harness.becomeJobSeekerWithResume('seeker');

      await request(harness.server)
        .get(`${APPLICATIONS_URL}/${UNKNOWN_ID}`)
        .set('Authorization', harness.authHeader('seeker'))
        .expect(404);
    });

    it('rejects a malformed application id with 400', async () => {
      await harness.becomeJobSeekerWithResume('seeker');

      await request(harness.server)
        .get(`${APPLICATIONS_URL}/not-a-uuid`)
        .set('Authorization', harness.authHeader('seeker'))
        .expect(400);
    });

    it('tells a user without a job seeker profile that they need one', async () => {
      const res = await request(harness.server)
        .get(`${APPLICATIONS_URL}/${UNKNOWN_ID}`)
        .set('Authorization', harness.authHeader('no-profile-user'))
        .expect(403);

      expect(res.body.message).toMatch(/job seeker profile/i);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(harness.server)
        .get(`${APPLICATIONS_URL}/${UNKNOWN_ID}`)
        .expect(401);
    });
  });
});
