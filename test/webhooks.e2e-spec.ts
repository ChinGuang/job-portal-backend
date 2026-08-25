/* eslint-disable @typescript-eslint/no-unsafe-call */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TestAuthSeam } from './helpers/auth.helper';

// Mock jwks-rsa to return process.env.TEST_PUBLIC_KEY directly in-memory,
// matching the seam used in test/auth.e2e-spec.ts.
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => (_req: any, _rawJwtToken: any, cb: any) => {
    cb(null, process.env.TEST_PUBLIC_KEY);
  }),
}));

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET as string;
const WEBHOOK_URL = '/webhooks/supabase/users';

interface UserRow {
  supabaseId: string;
  email: string;
  deletedAt: string | null;
}

function insertEvent(id: string, email: string) {
  return {
    type: 'INSERT',
    table: 'users',
    schema: 'auth',
    record: { id, email },
    old_record: null,
  };
}

function updateEvent(id: string, email: string, previousEmail: string) {
  return {
    type: 'UPDATE',
    table: 'users',
    schema: 'auth',
    record: { id, email },
    old_record: { id, email: previousEmail },
  };
}

function deleteEvent(id: string, email: string) {
  return {
    type: 'DELETE',
    table: 'users',
    schema: 'auth',
    record: null,
    old_record: { id, email },
  };
}

describe('Supabase user webhook (e2e)', () => {
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

  const findUsers = (supabaseId: string): Promise<UserRow[]> =>
    dataSource.query<UserRow[]>(
      'SELECT "supabaseId", email, "deletedAt" FROM users WHERE "supabaseId" = $1',
      [supabaseId],
    );

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('shared secret guard', () => {
    it('rejects a call with no secret header', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .send(insertEvent('webhook-uuid-1', 'a@example.com'))
        .expect(401);
    });

    it('rejects a call with the wrong secret', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', 'not-the-real-secret')
        .send(insertEvent('webhook-uuid-1', 'a@example.com'))
        .expect(401);
    });

    it('checks the secret before any processing', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .send(insertEvent('webhook-uuid-8', 'h@example.com'))
        .expect(401);

      // No row was written, so the guard ran ahead of the handler.
      expect(await findUsers('webhook-uuid-8')).toHaveLength(0);
    });
  });

  describe('INSERT / UPDATE events', () => {
    it('upserts a user keyed on supabaseId', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-2', 'b@example.com'))
        .expect(200);

      const rows = await findUsers('webhook-uuid-2');
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('b@example.com');
    });

    it('updates the mirrored email on an UPDATE event', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-9', 'before@example.com'))
        .expect(200);

      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(
          updateEvent(
            'webhook-uuid-9',
            'after@example.com',
            'before@example.com',
          ),
        )
        .expect(200);

      const rows = await findUsers('webhook-uuid-9');
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('after@example.com');
    });

    it('ignores events for tables it does not mirror', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({
          type: 'INSERT',
          table: 'sessions',
          schema: 'auth',
          record: { id: 'webhook-uuid-10', email: 'i@example.com' },
          old_record: null,
        })
        .expect(200);

      expect(await findUsers('webhook-uuid-10')).toHaveLength(0);
    });

    it('is idempotent for duplicate delivery of the same event', async () => {
      const event = insertEvent('webhook-uuid-3', 'c@example.com');

      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(event)
        .expect(200);
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(event)
        .expect(200);

      const rows = await findUsers('webhook-uuid-3');
      expect(rows).toHaveLength(1);
    });

    it('returns 2xx for an event type it deliberately ignores', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({
          type: 'TRUNCATE',
          table: 'users',
          schema: 'auth',
          record: null,
          old_record: null,
        })
        .expect(200);
    });

    it('converges on one row when the request arrives before the webhook', async () => {
      // Lazy provisioning in the guard creates the row first.
      const token = authSeam.mintToken('webhook-uuid-4', {
        email: 'd@example.com',
      });
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-4', 'd@example.com'))
        .expect(200);

      expect(await findUsers('webhook-uuid-4')).toHaveLength(1);
    });

    it('converges on one row when the webhook arrives before the request', async () => {
      // The webhook creates the row; lazy provisioning must reuse it.
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-11', 'j@example.com'))
        .expect(200);

      const token = authSeam.mintToken('webhook-uuid-11', {
        email: 'j@example.com',
      });
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(await findUsers('webhook-uuid-11')).toHaveLength(1);
    });
  });

  describe('DELETE events', () => {
    it('soft-deletes the local user', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-5', 'e@example.com'))
        .expect(200);

      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(deleteEvent('webhook-uuid-5', 'e@example.com'))
        .expect(200);

      const rows = await findUsers('webhook-uuid-5');
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();
    });

    it('is harmless on duplicate delivery', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-6', 'f@example.com'))
        .expect(200);

      const event = deleteEvent('webhook-uuid-6', 'f@example.com');
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(event)
        .expect(200);
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(event)
        .expect(200);

      const rows = await findUsers('webhook-uuid-6');
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();
    });

    it('is rejected rather than resurrected by the auth guard', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(insertEvent('webhook-uuid-7', 'g@example.com'))
        .expect(200);
      await request(app.getHttpServer())
        .post(WEBHOOK_URL)
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send(deleteEvent('webhook-uuid-7', 'g@example.com'))
        .expect(200);

      const token = authSeam.mintToken('webhook-uuid-7', {
        email: 'changed@example.com',
      });
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      const rows = await findUsers('webhook-uuid-7');
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();
      // The deleted row is detected before lazy provisioning runs, so the
      // rejected request leaves it untouched.
      expect(rows[0].email).toBe('g@example.com');
    });
  });
});
