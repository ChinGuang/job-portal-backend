/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication, UnauthorizedException } from '@nestjs/common';
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

  const mockUserRepoService = {
    findOrCreateFromToken: jest
      .fn()
      .mockImplementation(async (claims: { id: string; email: string }) => {
        // Simulate validation branch for deleted / inactive user
        if (claims.id === 'deleted-user-uuid') {
          throw new UnauthorizedException(
            'User account is disabled or deleted',
          );
        }

        return {
          id: claims.id,
          supabaseId: claims.id,
          email: claims.email,
          provider: 'SUPABASE',
        };
      }),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /me - Happy Path', () => {
    it('allows access when token is signed by local seam key', async () => {
      const mockToken = authSeam.mintToken('user-uuid-999', {
        email: 'dev@test.com',
      });

      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(res.body.user.id).toBe('user-uuid-999');
      expect(res.body.user.email).toBe('dev@test.com');
      expect(res.body.user.supabaseId).toBeUndefined();
    });
  });

  describe('GET /me - Guard & Token Rejections', () => {
    it('returns 401 when Authorization header is missing', async () => {
      await request(app.getHttpServer()).get('/me').expect(401);
    });

    it('returns 401 when token is malformed', async () => {
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', 'Bearer not-a-valid-jwt-token')
        .expect(401);
    });

    it('returns 401 when token is expired', async () => {
      const expiredToken = authSeam.mintToken('user-uuid-999', {
        email: 'dev@test.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('returns 401 when token issuer (iss) is wrong', async () => {
      const invalidIssuerToken = authSeam.mintToken(
        'user-uuid-999',
        { email: 'dev@test.com' },
        'http://wrong-issuer.com',
      );

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${invalidIssuerToken}`)
        .expect(401);
    });
  });

  describe('GET /me - Strategy Claims Validation (`SupabaseJwtStrategy.validate`)', () => {
    it('returns 401 when sub claim is missing', async () => {
      const tokenWithoutSub = authSeam.mintToken('', {
        sub: undefined,
        email: 'dev@test.com',
      });

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenWithoutSub}`)
        .expect(401);
    });

    it('returns 401 when email claim is not a string or is missing', async () => {
      const tokenWithBadEmail = authSeam.mintToken('user-uuid-999', {
        email: 12345, // Invalid payload type
      });

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenWithBadEmail}`)
        .expect(401);
    });

    it('returns 401 when user is deleted or rejected by UserRepoService', async () => {
      const tokenForDeletedUser = authSeam.mintToken('deleted-user-uuid', {
        email: 'deleted@test.com',
      });

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenForDeletedUser}`)
        .expect(401);
    });
  });
});
