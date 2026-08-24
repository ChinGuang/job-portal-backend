import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('db-test')
  async testDbConnection() {
    try {
      const isInitialized = this.dataSource.isInitialized;
      if (!isInitialized) {
        throw new Error('DB not initialized');
      }

      // Run a basic ping query
      const result = (await this.dataSource.query(
        'SELECT 1 + 1 AS result',
      )) as unknown;
      return {
        status: 'ok',
        message: 'PostgreSQL connection successful!',
        queryResult: result,
      };
    } catch {
      return new ServiceUnavailableException('Database connection failed.');
    }
  }
}
