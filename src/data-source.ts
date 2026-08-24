// src/data-source.ts
import dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
dotenv.config(); // Load environment variables from .env

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'my_db',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: ['prod', 'production'].every(
    (v) => v != process.env.NODE_ENV?.toLowerCase(),
  ),
};

const dataSource = new DataSource({
  ...dataSourceOptions,
  entities: ['src/**/*.entity.ts'], // Use .ts for CLI tasks
  migrations: ['src/database/migrations/*.ts'],
});

export default dataSource;
