/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InMemoryStorageService } from '../src/modules/storage/services/in-memory-storage.service';
import { STORAGE_SERVICE } from '../src/modules/storage/storage.tokens';
import { TestAuthSeam } from './helpers/auth.helper';
import { PNG_BUFFER, SVG_BUFFER } from './helpers/logo-fixtures';
import { PDF_BUFFER } from './helpers/resume-fixtures';

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => (_req: any, _rawJwtToken: any, cb: any) => {
    cb(null, process.env.TEST_PUBLIC_KEY);
  }),
}));

// `file-type` (ESM-only) is faked project-wide via jest-e2e.json's
// moduleNameMapper -> test/helpers/file-type.mock.ts, the same way jwks-rsa
// is faked above — see that file for why.

// A minimal but magic-number-valid JPEG (detected as image/jpeg).
const JPEG_LOGO_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

const PROFILE_URL = '/profiles/employer';
const LOGO_URL = '/profiles/employer/logo';

describe('Employer logo upload (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storage: InMemoryStorageService;
  const authSeam = new TestAuthSeam();

  beforeAll(async () => {
    authSeam.setupKeys();
    process.env.TEST_PUBLIC_KEY = authSeam.getPublicKeyPem();
    process.env.SUPABASE_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_SERVICE)
      .useClass(InMemoryStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    storage = moduleFixture.get<InMemoryStorageService>(STORAGE_SERVICE);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeader = (sub: string) => `Bearer ${authSeam.mintToken(sub)}`;

  // The response's logoUrl is a signed URL derived from the stored path
  // (see InMemoryStorageService.createSignedUrl), not the raw path itself.
  const expectSignedUrlFor = (logoUrl: unknown, path: string) => {
    expect(typeof logoUrl).toBe('string');
    expect(logoUrl as string).toContain(path);
  };

  async function createProfile(sub: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(PROFILE_URL)
      .set('Authorization', authHeader(sub))
      .send({ companyName: 'Logo Owner' })
      .expect(201);
    return res.body.id as string;
  }

  it('uploads a PNG logo and records its path on the profile', async () => {
    const profileId = await createProfile('logo-user-1');

    const res = await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-1'))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(201);

    expectSignedUrlFor(res.body.logoUrl, `logos/${profileId}/logo.png`);
    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(true);
  });

  it('uploads a JPEG logo', async () => {
    const profileId = await createProfile('logo-user-2');

    const res = await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-2'))
      .attach('file', JPEG_LOGO_BUFFER, 'logo.jpg')
      .expect(201);

    expectSignedUrlFor(res.body.logoUrl, `logos/${profileId}/logo.jpg`);
    expect(storage.has(`logos/${profileId}/logo.jpg`)).toBe(true);
  });

  it('rejects an SVG logo even with an image-looking filename', async () => {
    await createProfile('logo-user-3');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-3'))
      .attach('file', SVG_BUFFER, 'logo.png')
      .expect(400);
  });

  it('rejects a disallowed type detected by content (PDF)', async () => {
    await createProfile('logo-user-4');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-4'))
      .attach('file', PDF_BUFFER, 'logo.png')
      .expect(400);
  });

  it('rejects an oversized file', async () => {
    await createProfile('logo-user-5');

    const oversized = Buffer.concat([
      PNG_BUFFER,
      Buffer.alloc(3 * 1024 * 1024),
    ]);

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-5'))
      .attach('file', oversized, 'logo.png')
      .expect(413);
  });

  it('rejects a request with no file attached', async () => {
    await createProfile('logo-user-6');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-6'))
      .expect(400);
  });

  it('rejects the upload with 401 when unauthenticated', async () => {
    await request(app.getHttpServer())
      .post(LOGO_URL)
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(401);
  });

  it('rejects the upload when the caller has no employer profile', async () => {
    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-7'))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(404);
  });

  it('replaces the previous logo, deleting the old object', async () => {
    const profileId = await createProfile('logo-user-8');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-8'))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(201);
    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(true);

    const res = await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-8'))
      .attach('file', JPEG_LOGO_BUFFER, 'logo.jpg')
      .expect(201);

    expectSignedUrlFor(res.body.logoUrl, `logos/${profileId}/logo.jpg`);
    expect(storage.has(`logos/${profileId}/logo.jpg`)).toBe(true);
    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(false);
  });

  it('overwrites in place when re-uploading the same image type', async () => {
    const profileId = await createProfile('logo-user-9');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-9'))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-9'))
      .attach('file', PNG_BUFFER, 'logo-v2.png')
      .expect(201);

    expectSignedUrlFor(res.body.logoUrl, `logos/${profileId}/logo.png`);
    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(true);
  });

  it('stores the file under its real detected type, not a spoofed Content-Type', async () => {
    const profileId = await createProfile('logo-user-10');

    // Real PNG bytes, but the multipart field claims to be a JPEG — the
    // validator detects the true content and overrides file.mimetype, so the
    // service must store it as .png, not .jpg.
    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-10'))
      .attach('file', PNG_BUFFER, {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(true);
    expect(storage.has(`logos/${profileId}/logo.jpg`)).toBe(false);
  });

  it('reflects the uploaded logo on GET /profiles/employer', async () => {
    const profileId = await createProfile('logo-user-11');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-11'))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(PROFILE_URL)
      .set('Authorization', authHeader('logo-user-11'))
      .expect(200);

    expectSignedUrlFor(res.body.logoUrl, `logos/${profileId}/logo.png`);
  });

  it('leaves the previous logo intact if the replacement upload fails', async () => {
    const profileId = await createProfile('logo-user-12');

    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-12'))
      .attach('file', PNG_BUFFER, 'logo.png')
      .expect(201);
    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(true);

    storage.failNextUploadOnce();
    await request(app.getHttpServer())
      .post(LOGO_URL)
      .set('Authorization', authHeader('logo-user-12'))
      .attach('file', JPEG_LOGO_BUFFER, 'logo.jpg')
      .expect(500);

    // The old object was never deleted, and the profile still points at it.
    expect(storage.has(`logos/${profileId}/logo.png`)).toBe(true);
    const res = await request(app.getHttpServer())
      .get(PROFILE_URL)
      .set('Authorization', authHeader('logo-user-12'))
      .expect(200);
    expectSignedUrlFor(res.body.logoUrl, `logos/${profileId}/logo.png`);
  });
});
