/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import { ApiTestHarness, ApplicationBody } from './helpers/api.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

// A well-formed id that belongs to nothing, for the "not found" cases.
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const reviewUrl = (jobId: string) => `/jobs/${jobId}/applications`;
const statusUrl = (id: string) => `/applications/${id}/status`;

interface ReviewBody extends ApplicationBody {
  jobSeekerProfile: {
    id: string;
    name: string;
    headline: string | null;
    bio: string | null;
    phone: string | null;
    skills: string[];
    yearsOfExperience: number | null;
    userId?: string;
    resumeUrl?: string;
  };
}

describe('Employer application review (e2e)', () => {
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

  /** An employer with a published listing that one seeker has applied to. */
  async function arrangeOneApplication() {
    await harness.becomeEmployer('employer');
    const job = await harness.publishJob('employer');
    const { profile } = await harness.becomeJobSeekerWithResume('seeker');
    const application = await harness.applyToJob('seeker', job.id, {
      coverLetter: 'I would love to work on this.',
    });
    return { job, profile, application };
  }

  function listApplications(sub: string, jobId: string) {
    return request(harness.server)
      .get(reviewUrl(jobId))
      .set('Authorization', harness.authHeader(sub));
  }

  function setStatus(sub: string, id: string, status: unknown) {
    return request(harness.server)
      .patch(statusUrl(id))
      .set('Authorization', harness.authHeader(sub))
      .send({ status });
  }

  /** Walks an application to `status` through the API, as the owner would. */
  async function moveTo(id: string, ...statuses: string[]) {
    for (const status of statuses) {
      await setStatus('employer', id, status).expect(200);
    }
  }

  async function storedStatus(id: string): Promise<string> {
    const rows = await harness.query<{ status: string }>(
      'SELECT status FROM applications WHERE id = $1',
      [id],
    );
    return rows[0].status;
  }

  describe('GET /jobs/:id/applications', () => {
    it("lists an application with its cover letter and the applicant's profile", async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');
      const { profile } = await harness.becomeJobSeekerWithResume(
        'seeker',
        'Ada Lovelace',
        {
          headline: 'Senior Backend Engineer',
          bio: 'I build backend systems.',
          phone: '+1-555-123-4567',
          skills: ['TypeScript', 'NestJS'],
          yearsOfExperience: 7,
        },
      );
      await harness.applyToJob('seeker', job.id, {
        coverLetter: 'Here is why I am a fit.',
      });

      const res = await listApplications('employer', job.id).expect(200);

      expect(res.body.total).toBe(1);
      const [item] = res.body.items as ReviewBody[];
      expect(item).toMatchObject({
        jobId: job.id,
        jobSeekerProfileId: profile.id,
        coverLetter: 'Here is why I am a fit.',
        status: 'SUBMITTED',
      });
      expect(item.jobSeekerProfile).toMatchObject({
        id: profile.id,
        name: 'Ada Lovelace',
        headline: 'Senior Backend Engineer',
        bio: 'I build backend systems.',
        phone: '+1-555-123-4567',
        skills: ['TypeScript', 'NestJS'],
        yearsOfExperience: 7,
      });
    });

    it('shows the résumé the application was sent with', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');
      const { resumeUrl } = await harness.becomeJobSeekerWithResume('seeker');
      await harness.applyToJob('seeker', job.id);

      const res = await listApplications('employer', job.id).expect(200);

      expect((res.body.items as ReviewBody[])[0].resumeUrl).toBe(resumeUrl);
    });

    it("does not hand over the applicant's account id or profile résumé", async () => {
      const { job } = await arrangeOneApplication();

      const res = await listApplications('employer', job.id).expect(200);

      // The profile view an employer gets is narrower than the seeker's own.
      const { jobSeekerProfile } = (res.body.items as ReviewBody[])[0];
      expect(jobSeekerProfile.userId).toBeUndefined();
      expect(jobSeekerProfile.resumeUrl).toBeUndefined();
    });

    it('lists every application on the listing, from every applicant', async () => {
      const { job } = await arrangeOneApplication();
      await harness.becomeJobSeekerWithResume('seeker-2', 'Grace Hopper');
      await harness.applyToJob('seeker-2', job.id);

      const res = await listApplications('employer', job.id).expect(200);

      expect(res.body.total).toBe(2);
      const names = (res.body.items as ReviewBody[])
        .map((item) => item.jobSeekerProfile.name)
        .sort();
      expect(names).toEqual(['Ada Lovelace', 'Grace Hopper']);
    });

    it('is empty for a listing nobody has applied to', async () => {
      await harness.becomeEmployer('employer');
      const job = await harness.publishJob('employer');

      const res = await listApplications('employer', job.id).expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it("leaves out applications sent to the employer's other listings", async () => {
      const { job } = await arrangeOneApplication();
      const second = await harness.publishJob('employer', { title: 'Two' });
      await harness.applyToJob('seeker', second.id);

      const res = await listApplications('employer', second.id).expect(200);

      expect(res.body.total).toBe(1);
      expect((res.body.items as ReviewBody[])[0].jobId).toBe(second.id);
      expect(job.id).not.toBe(second.id);
    });

    it('filters the page down to one status', async () => {
      const { job } = await arrangeOneApplication();
      await harness.becomeJobSeekerWithResume('seeker-2', 'Grace Hopper');
      const second = await harness.applyToJob('seeker-2', job.id);
      await moveTo(second.id, 'REVIEWED');

      const res = await listApplications('employer', job.id)
        .query({ status: 'REVIEWED' })
        .expect(200);

      expect(res.body.total).toBe(1);
      expect((res.body.items as ReviewBody[])[0].id).toBe(second.id);
    });

    it('counts only the filtered applications, not every one on the listing', async () => {
      const { job } = await arrangeOneApplication();
      await harness.becomeJobSeekerWithResume('seeker-2', 'Grace Hopper');
      await harness.applyToJob('seeker-2', job.id);

      const res = await listApplications('employer', job.id)
        .query({ status: 'OFFERED' })
        .expect(200);

      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('rejects a status filter that is not a real status', async () => {
      const { job } = await arrangeOneApplication();

      await listApplications('employer', job.id)
        .query({ status: 'PONDERING' })
        .expect(400);
    });

    it('pages, and counts every application rather than just the page', async () => {
      const { job } = await arrangeOneApplication();
      await harness.becomeJobSeekerWithResume('seeker-2', 'Grace Hopper');
      await harness.applyToJob('seeker-2', job.id);

      const res = await listApplications('employer', job.id)
        .query({ limit: 1 })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(2);
    });

    it("refuses to show another company's listing, applications and all", async () => {
      const { job } = await arrangeOneApplication();
      await harness.becomeEmployer('rival', 'Rival Corp');

      const res = await listApplications('rival', job.id).expect(403);

      expect(res.body.message).toMatch(/another company/i);
    });

    it('returns 404 for a listing id that belongs to nothing', async () => {
      await harness.becomeEmployer('employer');

      await listApplications('employer', UNKNOWN_ID).expect(404);
    });

    it('rejects a malformed listing id with 400', async () => {
      await harness.becomeEmployer('employer');

      await request(harness.server)
        .get(reviewUrl('not-a-uuid'))
        .set('Authorization', harness.authHeader('employer'))
        .expect(400);
    });

    it('tells a job seeker they need an employer profile to review', async () => {
      const { job } = await arrangeOneApplication();

      const res = await listApplications('seeker', job.id).expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const { job } = await arrangeOneApplication();

      await request(harness.server).get(reviewUrl(job.id)).expect(401);
    });
  });

  describe('PATCH /applications/:id/status', () => {
    it('moves a SUBMITTED application to REVIEWED', async () => {
      const { application } = await arrangeOneApplication();

      const res = await setStatus(
        'employer',
        application.id,
        'REVIEWED',
      ).expect(200);

      expect((res.body as ApplicationBody).status).toBe('REVIEWED');
      await expect(storedStatus(application.id)).resolves.toBe('REVIEWED');
    });

    it('moves a REVIEWED application to OFFERED', async () => {
      const { application } = await arrangeOneApplication();
      await moveTo(application.id, 'REVIEWED');

      const res = await setStatus('employer', application.id, 'OFFERED').expect(
        200,
      );

      expect((res.body as ApplicationBody).status).toBe('OFFERED');
    });

    it('moves a REVIEWED application to REJECTED', async () => {
      const { application } = await arrangeOneApplication();
      await moveTo(application.id, 'REVIEWED');

      const res = await setStatus(
        'employer',
        application.id,
        'REJECTED',
      ).expect(200);

      expect((res.body as ApplicationBody).status).toBe('REJECTED');
    });

    it('shows the seeker the new status on their own application', async () => {
      const { application } = await arrangeOneApplication();
      await moveTo(application.id, 'REVIEWED', 'OFFERED');

      const res = await request(harness.server)
        .get(`/applications/${application.id}`)
        .set('Authorization', harness.authHeader('seeker'))
        .expect(200);

      expect((res.body as ApplicationBody).status).toBe('OFFERED');
    });

    it('refuses to decide a SUBMITTED application without reviewing it', async () => {
      const { application } = await arrangeOneApplication();

      const offered = await setStatus(
        'employer',
        application.id,
        'OFFERED',
      ).expect(409);
      await setStatus('employer', application.id, 'REJECTED').expect(409);

      expect(offered.body.message).toMatch(/SUBMITTED/);
      await expect(storedStatus(application.id)).resolves.toBe('SUBMITTED');
    });

    it('refuses to move a reviewed application back to SUBMITTED', async () => {
      const { application } = await arrangeOneApplication();
      await moveTo(application.id, 'REVIEWED');

      await setStatus('employer', application.id, 'SUBMITTED').expect(409);

      await expect(storedStatus(application.id)).resolves.toBe('REVIEWED');
    });

    it('refuses a no-op transition rather than silently succeeding', async () => {
      const { application } = await arrangeOneApplication();

      await setStatus('employer', application.id, 'SUBMITTED').expect(409);
    });

    it('treats OFFERED as final', async () => {
      const { application } = await arrangeOneApplication();
      await moveTo(application.id, 'REVIEWED', 'OFFERED');

      const res = await setStatus(
        'employer',
        application.id,
        'REJECTED',
      ).expect(409);
      await setStatus('employer', application.id, 'REVIEWED').expect(409);
      await setStatus('employer', application.id, 'SUBMITTED').expect(409);

      expect(res.body.message).toMatch(/final/i);
      await expect(storedStatus(application.id)).resolves.toBe('OFFERED');
    });

    it('treats REJECTED as final', async () => {
      const { application } = await arrangeOneApplication();
      await moveTo(application.id, 'REVIEWED', 'REJECTED');

      const res = await setStatus('employer', application.id, 'OFFERED').expect(
        409,
      );
      await setStatus('employer', application.id, 'REVIEWED').expect(409);

      expect(res.body.message).toMatch(/final/i);
      await expect(storedStatus(application.id)).resolves.toBe('REJECTED');
    });

    it("refuses to touch an application on another company's listing", async () => {
      const { application } = await arrangeOneApplication();
      await harness.becomeEmployer('rival', 'Rival Corp');

      // 404, not 403: a 403 would confirm that someone applied somewhere.
      await setStatus('rival', application.id, 'REVIEWED').expect(404);

      await expect(storedStatus(application.id)).resolves.toBe('SUBMITTED');
    });

    it('tells a job seeker they need an employer profile to decide anything', async () => {
      const { application } = await arrangeOneApplication();

      const res = await setStatus('seeker', application.id, 'OFFERED').expect(
        403,
      );

      expect(res.body.message).toMatch(/employer profile/i);
      await expect(storedStatus(application.id)).resolves.toBe('SUBMITTED');
    });

    it('stops a seeker who is also an employer from deciding their own application', async () => {
      const { application } = await arrangeOneApplication();
      // The capability guard alone would let this caller through; what stops
      // them is that the listing is not theirs.
      await harness.becomeEmployer('seeker', 'Seeker Side Project Ltd');

      await setStatus('seeker', application.id, 'OFFERED').expect(404);

      await expect(storedStatus(application.id)).resolves.toBe('SUBMITTED');
    });

    it('checks the employer capability before validating the body', async () => {
      const { application } = await arrangeOneApplication();

      // A caller missing the profile should hear about the profile, not about
      // a malformed status.
      const res = await setStatus('seeker', application.id, 42).expect(403);

      expect(res.body.message).toMatch(/employer profile/i);
    });

    it('rejects a status that is not a real one with 400', async () => {
      const { application } = await arrangeOneApplication();

      await setStatus('employer', application.id, 'PONDERING').expect(400);
      await setStatus('employer', application.id, undefined).expect(400);
    });

    it('rejects a body carrying anything but the status', async () => {
      const { application } = await arrangeOneApplication();

      await request(harness.server)
        .patch(statusUrl(application.id))
        .set('Authorization', harness.authHeader('employer'))
        .send({ status: 'REVIEWED', coverLetter: 'rewritten' })
        .expect(400);
    });

    it('returns 404 for an application id that belongs to nothing', async () => {
      await harness.becomeEmployer('employer');

      await setStatus('employer', UNKNOWN_ID, 'REVIEWED').expect(404);
    });

    it('rejects a malformed application id with 400', async () => {
      await harness.becomeEmployer('employer');

      await request(harness.server)
        .patch(statusUrl('not-a-uuid'))
        .set('Authorization', harness.authHeader('employer'))
        .send({ status: 'REVIEWED' })
        .expect(400);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const { application } = await arrangeOneApplication();

      await request(harness.server)
        .patch(statusUrl(application.id))
        .send({ status: 'REVIEWED' })
        .expect(401);
    });
  });
});
