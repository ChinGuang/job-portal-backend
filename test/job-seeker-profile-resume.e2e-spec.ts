/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { InMemoryStorageService } from '../src/modules/storage/services/in-memory-storage.service';
import { STORAGE_SERVICE } from '../src/modules/storage/storage.tokens';
import { TestAuthSeam } from './helpers/auth.helper';
import {
  buildMinimalDocx,
  JPEG_BUFFER,
  LEGACY_DOC_BUFFER,
  PDF_BUFFER,
} from './helpers/resume-fixtures';

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => (_req: any, _rawJwtToken: any, cb: any) => {
    cb(null, process.env.TEST_PUBLIC_KEY);
  }),
}));

// `file-type` (ESM-only) is faked project-wide via jest-e2e.json's
// moduleNameMapper -> test/helpers/file-type.mock.ts, the same way jwks-rsa
// is faked above — see that file for why.

const PROFILE_URL = '/profiles/job-seeker';
const RESUME_URL = '/profiles/job-seeker/resume';

describe('Job seeker résumé upload (e2e)', () => {
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

  // The response's resumeUrl is a signed URL derived from the stored path
  // (see InMemoryStorageService.createSignedUrl), not the raw path itself.
  const expectSignedUrlFor = (resumeUrl: unknown, path: string) => {
    expect(typeof resumeUrl).toBe('string');
    expect(resumeUrl as string).toContain(path);
  };

  async function createProfile(sub: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(PROFILE_URL)
      .set('Authorization', authHeader(sub))
      .send({ name: 'Resume Owner' })
      .expect(201);
    return res.body.id as string;
  }

  it('uploads a PDF résumé and records its path on the profile', async () => {
    const profileId = await createProfile('resume-user-1');

    const res = await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-1'))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(201);

    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.pdf`);
    expect(storage.has(`${profileId}/resume.pdf`)).toBe(true);
  });

  it('uploads a DOCX résumé', async () => {
    const profileId = await createProfile('resume-user-2');

    const res = await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-2'))
      .attach('file', buildMinimalDocx(), 'resume.docx')
      .expect(201);

    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.docx`);
    expect(storage.has(`${profileId}/resume.docx`)).toBe(true);
  });

  it('uploads a legacy .doc résumé', async () => {
    const profileId = await createProfile('resume-user-3');

    const res = await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-3'))
      .attach('file', LEGACY_DOC_BUFFER, 'resume.doc')
      .expect(201);

    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.doc`);
  });

  it('rejects a legacy binary-container file whose extension is not .doc', async () => {
    await createProfile('resume-user-4');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-4'))
      .attach('file', LEGACY_DOC_BUFFER, 'not-a-doc.xls')
      .expect(400);
  });

  it('rejects a disallowed file type even with a misleading filename', async () => {
    await createProfile('resume-user-5');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-5'))
      .attach('file', JPEG_BUFFER, 'resume.pdf')
      .expect(400);
  });

  it('rejects an oversized file', async () => {
    await createProfile('resume-user-6');

    const oversized = Buffer.concat([
      PDF_BUFFER,
      Buffer.alloc(6 * 1024 * 1024),
    ]);

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-6'))
      .attach('file', oversized, 'resume.pdf')
      .expect(413);
  });

  it('rejects a request with no file attached', async () => {
    await createProfile('resume-user-7');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-7'))
      .expect(400);
  });

  it('rejects the upload with 401 when unauthenticated', async () => {
    await request(app.getHttpServer())
      .post(RESUME_URL)
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(401);
  });

  it('rejects the upload with 404 when the caller has no job seeker profile', async () => {
    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-8'))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(404);
  });

  it('replaces the previous résumé, deleting the old object', async () => {
    const profileId = await createProfile('resume-user-9');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-9'))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(201);
    expect(storage.has(`${profileId}/resume.pdf`)).toBe(true);

    const res = await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-9'))
      .attach('file', buildMinimalDocx(), 'resume.docx')
      .expect(201);

    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.docx`);
    expect(storage.has(`${profileId}/resume.docx`)).toBe(true);
    expect(storage.has(`${profileId}/resume.pdf`)).toBe(false);
  });

  it('overwrites in place when re-uploading the same file type', async () => {
    const profileId = await createProfile('resume-user-10');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-10'))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-10'))
      .attach('file', PDF_BUFFER, 'resume-v2.pdf')
      .expect(201);

    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.pdf`);
    expect(storage.has(`${profileId}/resume.pdf`)).toBe(true);
  });

  it('reflects the uploaded résumé on GET /profiles/job-seeker', async () => {
    const profileId = await createProfile('resume-user-11');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-11'))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(PROFILE_URL)
      .set('Authorization', authHeader('resume-user-11'))
      .expect(200);

    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.pdf`);
  });

  it('stores the file under its real detected type, not a spoofed Content-Type', async () => {
    const profileId = await createProfile('resume-user-12');

    // Real PDF bytes, but the multipart field claims to be a .doc — the
    // validator detects the true content and overrides file.mimetype, so
    // the service must store it as .pdf, not .doc.
    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-12'))
      .attach('file', PDF_BUFFER, {
        filename: 'resume.doc',
        contentType: 'application/msword',
      })
      .expect(201);

    expect(storage.has(`${profileId}/resume.pdf`)).toBe(true);
    expect(storage.has(`${profileId}/resume.doc`)).toBe(false);
  });

  it('leaves the previous résumé intact if the replacement upload fails', async () => {
    const profileId = await createProfile('resume-user-13');

    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-13'))
      .attach('file', PDF_BUFFER, 'resume.pdf')
      .expect(201);
    expect(storage.has(`${profileId}/resume.pdf`)).toBe(true);

    storage.failNextUploadOnce();
    await request(app.getHttpServer())
      .post(RESUME_URL)
      .set('Authorization', authHeader('resume-user-13'))
      .attach('file', buildMinimalDocx(), 'resume.docx')
      .expect(500);

    // The old object was never deleted, and the profile still points at it.
    expect(storage.has(`${profileId}/resume.pdf`)).toBe(true);
    const res = await request(app.getHttpServer())
      .get(PROFILE_URL)
      .set('Authorization', authHeader('resume-user-13'))
      .expect(200);
    expectSignedUrlFor(res.body.resumeUrl, `${profileId}/resume.pdf`);
  });
});
