/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import { ApiTestHarness, ApplicationBody } from './helpers/api.helper';

jest.mock('jwks-rsa');

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const resumeUrl = (id: string) => `/applications/${id}/resume`;

describe('Employer résumé access (e2e)', () => {
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

  async function arrangeOneApplication(): Promise<{
    application: ApplicationBody;
  }> {
    await harness.becomeEmployer('employer');
    const job = await harness.publishJob('employer');
    await harness.becomeJobSeekerWithResume('seeker');
    const application = await harness.applyToJob('seeker', job.id);
    return { application };
  }

  function getResume(sub: string, id: string) {
    return request(harness.server)
      .get(resumeUrl(id))
      .set('Authorization', harness.authHeader(sub));
  }

  it('issues a short-lived signed URL to the job owner', async () => {
    const { application } = await arrangeOneApplication();

    const res = await getResume('employer', application.id).expect(200);

    expect(typeof res.body.resumeUrl).toBe('string');
    expect(res.body.resumeUrl).toContain(application.resumeUrl);
    expect(res.body.resumeUrl).toContain('expiresIn=300');
  });

  it("hides an application on another company's listing behind a 404", async () => {
    const { application } = await arrangeOneApplication();
    await harness.becomeEmployer('intruder', 'Intruder Co');

    await getResume('intruder', application.id).expect(404);
  });

  it('refuses the applicant themselves with 403 (no employer profile)', async () => {
    const { application } = await arrangeOneApplication();

    await getResume('seeker', application.id).expect(403);
  });

  it('refuses another job seeker with 403', async () => {
    const { application } = await arrangeOneApplication();
    await harness.becomeJobSeekerWithResume('other-seeker', 'Grace Hopper');

    await getResume('other-seeker', application.id).expect(403);
  });

  it('returns 404 for an application id that belongs to nothing', async () => {
    await harness.becomeEmployer('employer');

    await getResume('employer', UNKNOWN_ID).expect(404);
  });

  it('rejects a malformed application id with 400', async () => {
    await harness.becomeEmployer('employer');

    await getResume('employer', 'not-a-uuid').expect(400);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { application } = await arrangeOneApplication();

    await request(harness.server).get(resumeUrl(application.id)).expect(401);
  });
});
