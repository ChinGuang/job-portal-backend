import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { SwaggerTag } from './common/constants/swagger';

class HealthCheckSuccessDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'Health Check Successful' })
  message!: string;
}

class HealthCheckErrorDto {
  @ApiProperty({ example: 503 })
  statusCode!: number;

  @ApiProperty({ example: 'Database connection failed.' })
  message!: string;

  @ApiProperty({ example: 'Service Unavailable' })
  error!: string;
}

@ApiTags(SwaggerTag.COMMON)
@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('/health')
  @ApiOperation({ summary: 'Check API and Database Health Status' })
  @ApiResponse({
    status: 200,
    description: 'Database is initialized and healthy.',
    type: HealthCheckSuccessDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Database connection failed or is not initialized.',
    type: HealthCheckErrorDto,
  })
  async checkHealth() {
    try {
      const isInitialized = this.dataSource.isInitialized;
      if (!isInitialized) {
        throw new Error('DB not initialized');
      }
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database connection failed.');
    }
    return {
      status: 'ok',
      message: 'Health Check Successful',
    };
  }
}
