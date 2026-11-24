import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  API_PREFIX,
  APP_OPTIONS,
  configureApp,
  createOpenApiDocument,
  DOCS_PATH,
} from './app.setup';
import type { AppConfig } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, APP_OPTIONS);
  configureApp(app);
  // Close DB/Redis connections cleanly on SIGTERM (docker stop).
  app.enableShutdownHooks();
  // Swagger UI at /api/docs, raw JSON at /api/docs-json
  SwaggerModule.setup(DOCS_PATH, app, createOpenApiDocument(app));

  const port = app
    .get<ConfigService<AppConfig, true>>(ConfigService)
    .get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(
    `API on http://localhost:${port}/${API_PREFIX} — docs on http://localhost:${port}/${DOCS_PATH}`,
    'Bootstrap',
  );
}

void bootstrap();
