import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvKey } from './common/constants/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        console.log(configService.get<number>(EnvKey.POSTGRES_USER));
        return {
          type: 'postgres',
          host: configService.get<string>(EnvKey.POSTGRES_HOST),
          port: configService.get<number>(EnvKey.POSTGRES_PORT),
          username: configService.get<string>(EnvKey.POSTGRES_USER),
          password: configService.get<string>(EnvKey.POSTGRES_PASSWORD),
          database: configService.get<string>(EnvKey.POSTGRES_DB),
          autoLoadEntities: true,
          synchronize: configService.get<string>(EnvKey.NODE_ENV) == 'prod',
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
