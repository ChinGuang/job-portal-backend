import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Override ThrottlerGuard so high-volume E2E runs don't get 429 status
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 OK when database is connected and SELECT 1 succeeds', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        message: 'Health Check Successful',
      });
    });

    it('should return 503 status when isInitialized is false', async () => {
      jest.replaceProperty(dataSource, 'isInitialized', false);

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        message: 'Database connection failed.',
      });

      jest.restoreAllMocks();
    });

    it('should return 503 status when SELECT 1 fails', async () => {
      // Mock raw SQL query execution to fail (e.g., query timeout / dropped DB connection)
      jest
        .spyOn(dataSource, 'query')
        .mockRejectedValueOnce(new Error('Query execution failed'));

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        message: 'Database connection failed.',
      });

      jest.restoreAllMocks();
    });
  });
});
