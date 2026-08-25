/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TestAuthSeam } from './helpers/auth.helper';

// Implementation lives in test/__mocks__/jwks-rsa.ts.
jest.mock('jwks-rsa');

const URL = '/profiles/job-seeker';

describe('Job seeker profile (e2e)', () => {
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

  describe('POST /profiles/job-seeker', () => {
    it('creates a profile with only the required field', async () => {
      const res = await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-1'))
        .send({ name: 'Jane Doe' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Jane Doe',
        skills: [],
      });
      expect(res.body.id).toBeDefined();
    });

    it('creates a profile with all optional fields', async () => {
      const res = await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-2'))
        .send({
          name: 'John Smith',
          headline: 'Full Stack Dev',
          bio: 'I write code.',
          phone: '+1-555-0100',
          skills: ['TypeScript', 'React'],
          yearsOfExperience: 4,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'John Smith',
        headline: 'Full Stack Dev',
        bio: 'I write code.',
        phone: '+1-555-0100',
        skills: ['TypeScript', 'React'],
        yearsOfExperience: 4,
      });
    });

    it('rejects a second profile for the same user with 409', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-3'))
        .send({ name: 'First' })
        .expect(201);

      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-3'))
        .send({ name: 'Second attempt' })
        .expect(409);
    });

    it('rejects creation with no Authorization header', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .send({ name: 'No Auth' })
        .expect(401);
    });

    it('rejects creation with an invalid token', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', 'Bearer not-a-jwt')
        .send({ name: 'Bad Token' })
        .expect(401);
    });

    it('rejects a missing name with 400', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-4'))
        .send({ headline: 'No name here' })
        .expect(400);
    });

    it('rejects an empty-string name with 400', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-5'))
        .send({ name: '' })
        .expect(400);
    });

    it('rejects a negative yearsOfExperience with 400', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-6'))
        .send({ name: 'Bad Years', yearsOfExperience: -1 })
        .expect(400);
    });

    it('rejects unknown fields with 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-7'))
        .send({ name: 'Extra Field', resumeUrl: 'https://example.com/x.pdf' })
        .expect(400);
    });
  });

  describe('GET /profiles/job-seeker', () => {
    it("returns the caller's own profile", async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-8'))
        .send({ name: 'Reader' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-8'))
        .expect(200);

      expect(res.body.name).toBe('Reader');
    });

    it('returns 404 when the caller has no profile yet', async () => {
      await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-9'))
        .expect(404);
    });

    it('returns 401 with no auth', async () => {
      await request(app.getHttpServer()).get(URL).expect(401);
    });

    it("never returns another user's profile (isolation)", async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-10-owner'))
        .send({ name: 'Owner Profile' })
        .expect(201);

      // The second user has no profile of their own — GET must 404, not
      // leak the first user's profile.
      const res = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-10-other'))
        .expect(404);

      expect(JSON.stringify(res.body)).not.toContain('Owner Profile');
    });
  });

  describe('PATCH /profiles/job-seeker', () => {
    it('updates provided fields and leaves others untouched', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-11'))
        .send({ name: 'Original Name', headline: 'Original Headline' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-11'))
        .send({ headline: 'Updated Headline' })
        .expect(200);

      expect(res.body.name).toBe('Original Name');
      expect(res.body.headline).toBe('Updated Headline');
    });

    it('updates every field at once', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-12'))
        .send({ name: 'Before' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-12'))
        .send({
          name: 'After',
          headline: 'New Headline',
          bio: 'New bio',
          phone: '+1-555-0199',
          skills: ['Go', 'Kubernetes'],
          yearsOfExperience: 10,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        name: 'After',
        headline: 'New Headline',
        bio: 'New bio',
        phone: '+1-555-0199',
        skills: ['Go', 'Kubernetes'],
        yearsOfExperience: 10,
      });
    });

    it('returns 404 when the caller has no profile to update', async () => {
      await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-13'))
        .send({ headline: 'No profile yet' })
        .expect(404);
    });

    it('returns 401 with no auth', async () => {
      await request(app.getHttpServer())
        .patch(URL)
        .send({ headline: 'x' })
        .expect(401);
    });

    it('rejects an invalid field value with 400 (e.g. name too short)', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-14'))
        .send({ name: 'Valid Name' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-14'))
        .send({ name: '' })
        .expect(400);
    });

    it("cannot update another user's profile (isolation)", async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-15-owner'))
        .send({ name: 'Owner' })
        .expect(201);

      // The "other" user has no profile — PATCH must 404 for them, never
      // touch the owner's row.
      await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-15-other'))
        .send({ name: 'Hijacked' })
        .expect(404);

      const res = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-15-owner'))
        .expect(200);
      expect(res.body.name).toBe('Owner');
    });
  });
});
