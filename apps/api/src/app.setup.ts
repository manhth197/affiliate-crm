import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import type { AppConfig } from './config/env.validation';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/** HTTP setup shared by main.ts, the OpenAPI export and e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Affiliate CRM API')
    .setDescription(
      'REST API for the Affiliate CRM. Source of truth: docs/api-contract.md. ' +
        'Money is VND as integers; dates are ISO 8601 UTC.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config, {
    // "AuthController.login" -> "Auth_login"
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}
