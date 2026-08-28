/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import { ApiTestHarness } from './helpers/api.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

const WEBHOOK_URL = '/webhooks/supabase/users';
const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET as string;

/** The Supabase DELETE payload for `auth.users`: only `old_record` is set. */
function deleteEvent(supabaseId: string, email: string) {
  return {
    type: 'DELETE',
    table: 'users',
    schema: 'auth',
    record: null,
    old_record: { id: supabaseId, email },
  };
}

describe('Soft-delete cascade (e2e)', () => {
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

  /** Fires the Supabase DELETE webhook for `sub`, as Supabase would on account removal. */
  const deleteUser = (sub: string) =>
    request(harness.server)
      .post(WEBHOOK_URL)
      .set('x-webhook-secret', WEBHOOK_SECRET)
      .send(deleteEvent(sub, `${sub}@example.com`));

  /** Every listing status held by one employer profile, straight from the database. */
  const jobStatuses = async (employerProfileId: string): Promise<string[]> => {
    const rows = await harness.query<{ status: string }>(
      `SELECT status FROM jobs WHERE "employerProfileId" = $1 ORDER BY status`,
      [employerProfileId],
    );
    return rows.map((r) => r.status);
  };

  describe('DELETE webhook cascades to the employer’s listings', () => {
    it('moves every one of the deleted employer’s listings to ARCHIVED', async () => {
      const employer = await harness.becomeEmployer('cascade-owner');
      const draft = await harness.createJob('cascade-owner');
      const published = await harness.publishJob('cascade-owner', {
        title: 'Platform Engineer',
      });

      await deleteUser('cascade-owner').expect(200);

      const rows = await harness.query<{ id: string; status: string }>(
        `SELECT id, status FROM jobs WHERE "employerProfileId" = $1`,
        [employer.id],
      );
      const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
      expect(byId[draft.id]).toBe('ARCHIVED');
      expect(byId[published.id]).toBe('ARCHIVED');
    });

    it('archives listings regardless of the status they were in', async () => {
      const employer = await harness.becomeEmployer('cascade-mixed');
      await harness.createJob('cascade-mixed'); // DRAFT
      await harness.publishJob('cascade-mixed', { title: 'One' }); // PUBLISHED
      const closed = await harness.publishJob('cascade-mixed', { title: 'Two' });
      await harness
        .setJobStatus('cascade-mixed', closed.id, 'CLOSED')
        .expect(200);

      await deleteUser('cascade-mixed').expect(200);

      expect(await jobStatuses(employer.id)).toEqual([
        'ARCHIVED',
        'ARCHIVED',
        'ARCHIVED',
      ]);
    });

    it('leaves the local user soft-deleted, not resurrected by the cascade', async () => {
      await harness.becomeEmployer('cascade-user');
      await harness.publishJob('cascade-user');

      await deleteUser('cascade-user').expect(200);

      const rows = await harness.query<{ deletedAt: string | null }>(
        `SELECT "deletedAt" FROM users WHERE "supabaseId" = $1`,
        ['cascade-user'],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();
    });
  });

  describe('other parties’ records are left intact', () => {
    it('does not touch another employer’s listings', async () => {
      const doomed = await harness.becomeEmployer('cascade-a', 'Company A');
      await harness.publishJob('cascade-a');

      const bystander = await harness.becomeEmployer('cascade-b', 'Company B');
      await harness.publishJob('cascade-b', { title: 'Untouched Role' });

      await deleteUser('cascade-a').expect(200);

      expect(await jobStatuses(doomed.id)).toEqual(['ARCHIVED']);
      // The bystander's listing keeps the status it had.
      expect(await jobStatuses(bystander.id)).toEqual(['PUBLISHED']);
    });

    it('keeps a job seeker’s profile and applications when the employer is deleted', async () => {
      await harness.becomeEmployer('cascade-emp');
      const job = await harness.publishJob('cascade-emp');

      const { profile } = await harness.becomeJobSeekerWithResume('cascade-seeker');
      await request(harness.server)
        .post(`/jobs/${job.id}/applications`)
        .set('Authorization', harness.authHeader('cascade-seeker'))
        .send({ coverLetter: 'Please consider me.' })
        .expect(201);

      await deleteUser('cascade-emp').expect(200);

      // The seeker's profile still stands — a hole here would corrupt their record.
      const seekerRows = await harness.query<{ id: string }>(
        `SELECT p.id FROM job_seeker_profiles p
           JOIN users u ON u.id = p."userId"
          WHERE u."supabaseId" = $1`,
        ['cascade-seeker'],
      );
      expect(seekerRows).toHaveLength(1);

      // The application they submitted still exists.
      const appRows = await harness.query<{ status: string }>(
        `SELECT status FROM applications WHERE "jobSeekerProfileId" = $1`,
        [profile.id],
      );
      expect(appRows).toHaveLength(1);
    });
  });
});
