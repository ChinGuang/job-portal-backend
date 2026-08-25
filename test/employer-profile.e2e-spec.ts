/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

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

const URL = '/profiles/employer';
const JOB_SEEKER_URL = '/profiles/job-seeker';

describe('Employer profile (e2e)', () => {
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

  describe('POST /profiles/employer', () => {
    it('creates a profile with only the required field', async () => {
      const res = await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-1'))
        .send({ companyName: 'Acme Inc' })
        .expect(201);

      expect(res.body).toMatchObject({ companyName: 'Acme Inc' });
      expect(res.body.id).toBeDefined();
    });

    it('creates a profile with all optional fields', async () => {
      const res = await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-2'))
        .send({
          companyName: 'Globex',
          websiteUrl: 'https://globex.example.com',
          logoUrl: 'https://globex.example.com/logo.png',
          industry: 'Software',
          companySize: '11-50',
          description: 'We build things.',
          address: '1 Market St, Springfield',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        companyName: 'Globex',
        websiteUrl: 'https://globex.example.com',
        logoUrl: 'https://globex.example.com/logo.png',
        industry: 'Software',
        companySize: '11-50',
        description: 'We build things.',
        address: '1 Market St, Springfield',
      });
    });

    it('rejects a second profile for the same user with 409', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-3'))
        .send({ companyName: 'First' })
        .expect(201);

      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-3'))
        .send({ companyName: 'Second attempt' })
        .expect(409);
    });

    it('rejects creation with no Authorization header', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .send({ companyName: 'No Auth' })
        .expect(401);
    });

    it('rejects creation with an invalid token', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', 'Bearer not-a-jwt')
        .send({ companyName: 'Bad Token' })
        .expect(401);
    });

    it('rejects a missing companyName with 400', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-4'))
        .send({ industry: 'No company name here' })
        .expect(400);
    });

    it('rejects an empty-string companyName with 400', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-5'))
        .send({ companyName: '' })
        .expect(400);
    });

    it('rejects a non-URL websiteUrl with 400', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-6'))
        .send({ companyName: 'Bad URL Co', websiteUrl: 'not-a-url' })
        .expect(400);
    });

    it('rejects unknown fields with 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-7'))
        .send({ companyName: 'Extra Field', taxId: '123-45-6789' })
        .expect(400);
    });
  });

  describe('GET /profiles/employer', () => {
    it("returns the caller's own profile", async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-8'))
        .send({ companyName: 'Reader Co' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-8'))
        .expect(200);

      expect(res.body.companyName).toBe('Reader Co');
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

    it('returns each caller their own profile, never the other user’s (isolation)', async () => {
      // Both users own a DISTINCT profile. The endpoint keys only on the
      // caller's own id, so the meaningful isolation property is that each
      // caller reads strictly their own row even while the other's exists —
      // not merely that a profile-less user gets a 404.
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-10-a'))
        .send({ companyName: 'Company A' })
        .expect(201);

      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-10-b'))
        .send({ companyName: 'Company B' })
        .expect(201);

      const aRes = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-10-a'))
        .expect(200);
      expect(aRes.body.companyName).toBe('Company A');
      expect(JSON.stringify(aRes.body)).not.toContain('Company B');

      const bRes = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-10-b'))
        .expect(200);
      expect(bRes.body.companyName).toBe('Company B');
      expect(JSON.stringify(bRes.body)).not.toContain('Company A');
    });
  });

  describe('PATCH /profiles/employer', () => {
    it('updates provided fields and leaves others untouched', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-11'))
        .send({ companyName: 'Original Co', industry: 'Original Industry' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-11'))
        .send({ industry: 'Updated Industry' })
        .expect(200);

      expect(res.body.companyName).toBe('Original Co');
      expect(res.body.industry).toBe('Updated Industry');
    });

    it('updates every field at once', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-12'))
        .send({ companyName: 'Before Co' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-12'))
        .send({
          companyName: 'After Co',
          websiteUrl: 'https://after.example.com',
          logoUrl: 'https://after.example.com/logo.png',
          industry: 'Fintech',
          companySize: '201-500',
          description: 'A new description.',
          address: '99 New Ave',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        companyName: 'After Co',
        websiteUrl: 'https://after.example.com',
        logoUrl: 'https://after.example.com/logo.png',
        industry: 'Fintech',
        companySize: '201-500',
        description: 'A new description.',
        address: '99 New Ave',
      });
    });

    it('returns 404 when the caller has no profile to update', async () => {
      await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-13'))
        .send({ industry: 'No profile yet' })
        .expect(404);
    });

    it('returns 401 with no auth', async () => {
      await request(app.getHttpServer())
        .patch(URL)
        .send({ industry: 'x' })
        .expect(401);
    });

    it('rejects an invalid field value with 400 (e.g. empty companyName)', async () => {
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-14'))
        .send({ companyName: 'Valid Co' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-14'))
        .send({ companyName: '' })
        .expect(400);
    });

    it('a PATCH by one user changes only their own profile, never the other user’s (isolation)', async () => {
      // Both users own a profile. A mutation by B must land on B's row and
      // leave A's untouched — proving the write is scoped to the caller even
      // when another user's row exists to be clobbered.
      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-15-a'))
        .send({ companyName: 'Company A' })
        .expect(201);

      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader('user-15-b'))
        .send({ companyName: 'Company B' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(URL)
        .set('Authorization', authHeader('user-15-b'))
        .send({ companyName: 'Company B Renamed' })
        .expect(200);

      // B's own row reflects the change.
      const bRes = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-15-b'))
        .expect(200);
      expect(bRes.body.companyName).toBe('Company B Renamed');

      // A's row is untouched by B's PATCH.
      const aRes = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader('user-15-a'))
        .expect(200);
      expect(aRes.body.companyName).toBe('Company A');
    });
  });

  describe('One account, both profiles', () => {
    it('allows the same user to hold a job seeker and an employer profile', async () => {
      const sub = 'user-16-dual';

      await request(app.getHttpServer())
        .post(JOB_SEEKER_URL)
        .set('Authorization', authHeader(sub))
        .send({ name: 'Dual Wielder' })
        .expect(201);

      await request(app.getHttpServer())
        .post(URL)
        .set('Authorization', authHeader(sub))
        .send({ companyName: 'Dual Co' })
        .expect(201);

      const seeker = await request(app.getHttpServer())
        .get(JOB_SEEKER_URL)
        .set('Authorization', authHeader(sub))
        .expect(200);
      expect(seeker.body.name).toBe('Dual Wielder');

      const employer = await request(app.getHttpServer())
        .get(URL)
        .set('Authorization', authHeader(sub))
        .expect(200);
      expect(employer.body.companyName).toBe('Dual Co');
    });
  });
});
