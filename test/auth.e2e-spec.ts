/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRepoService } from '../src/modules/users/services/user-repo.service';
import { TestAuthSeam } from './helpers/auth.helper';

// Mock jwks-rsa to return process.env.TEST_PUBLIC_KEY directly in-memory
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => (_req: any, _rawJwtToken: any, cb: any) => {
    cb(null, process.env.TEST_PUBLIC_KEY);
  }),
}));

describe('Auth (Test Seam)', () => {
  let app: INestApplication;
  const authSeam = new TestAuthSeam();

  // Mock database service to eliminate live DB reliance in E2E tests
  const mockUserRepoService = {
    findOrCreateFromToken: jest
      .fn()
      .mockImplementation(async (claims: { id: string; email: string }) => ({
        id: claims.id, // Set id directly to claims.id (e.g. 'user-uuid-999')
        supabaseId: claims.id,
        email: claims.email,
        provider: 'SUPABASE',
      })),
  };

  beforeAll(async () => {
    authSeam.setupKeys();
    process.env.TEST_PUBLIC_KEY = authSeam.getPublicKeyPem();
    process.env.SUPABASE_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserRepoService)
      .useValue(mockUserRepoService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows access when token is signed by local seam key', async () => {
    const mockToken = authSeam.mintToken('user-uuid-999', {
      email: 'dev@test.com',
    });

    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${mockToken}`)
      .expect(200);

    // Verify against returned user property from controller payload
    expect(res.body.user.id).toBe('user-uuid-999');
    expect(res.body.user.supabaseId).toBeUndefined();
  });
});
