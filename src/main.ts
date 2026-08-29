import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvKey } from './common/constants/config';
import { SwaggerTag } from './common/constants/swagger';

/**
 * Turn the CORS_ORIGINS env value into a value enableCors understands:
 *   - unset / empty  -> `true` (reflect the request origin — dev-friendly)
 *   - "*"            -> `true` (allow any origin)
 *   - a list         -> the exact allow-list, e.g. "http://localhost:5173,https://app.example.com"
 */
function resolveCorsOrigin(raw: string | undefined): true | string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) {
    return true;
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: resolveCorsOrigin(configService.get<string>(EnvKey.CORS_ORIGINS)),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Job Portal Backend')
    .setDescription('The Job Portal Backend API')
    .addTag(SwaggerTag.COMMON)
    .addTag(SwaggerTag.WEBHOOKS)
    .addTag(SwaggerTag.PROFILES)
    .addTag(SwaggerTag.JOBS)
    .addTag(SwaggerTag.APPLICATIONS)
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
